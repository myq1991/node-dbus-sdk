#!/usr/bin/env python3
"""
A GDBusObjectManagerClient following a service's ObjectManager, for the interop tests.

Usage: object_manager_client.py <bus address> <service name> <manager path>

Prints one JSON line per report: {"ready": view} once loaded, then, for every line read from stdin (a step name),
{"step": name, "events": [...], "view": view} once pending signals have been handled. A view maps object paths to
interfaces to properties, each property as [GVariant type string, value]; the standard org.freedesktop.DBus.*
interfaces are listed without properties. "quit" on stdin exits.
"""
import json
import sys

import gi

gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

address, service, manager_path = sys.argv[1:4]
connection = Gio.DBusConnection.new_for_address_sync(
    address, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION, None, None)
manager = Gio.DBusObjectManagerClient.new_sync(connection, Gio.DBusObjectManagerClientFlags.NONE, service, manager_path, None, None, None)
events = []


def jsonable(value):
    if isinstance(value, (bytes, bytearray)):
        return list(value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def view():
    objects = {}
    for obj in manager.get_objects():
        interfaces = {}
        for proxy in obj.get_interfaces():
            name = proxy.get_interface_name()
            properties = {}
            if not name.startswith('org.freedesktop.DBus.'):
                for property_name in proxy.get_cached_property_names() or []:
                    value = proxy.get_cached_property(property_name)
                    properties[property_name] = [value.get_type_string(), jsonable(value.unpack())]
            interfaces[name] = properties
        objects[obj.get_object_path()] = interfaces
    return objects


def report(**fields):
    print(json.dumps(fields, sort_keys=True), flush=True)


manager.connect('object-added', lambda m, o: events.append(['object-added', o.get_object_path()]))
manager.connect('object-removed', lambda m, o: events.append(['object-removed', o.get_object_path()]))
manager.connect('interface-added', lambda m, o, i: events.append(['interface-added', o.get_object_path(), i.get_interface_name()]))
manager.connect('interface-removed', lambda m, o, i: events.append(['interface-removed', o.get_object_path(), i.get_interface_name()]))
manager.connect('interface-proxy-properties-changed', lambda m, o, i, changed, invalidated: events.append(
    ['properties-changed', o.get_object_path(), i.get_interface_name(), sorted(changed.keys()), sorted(invalidated)]))

loop = GLib.MainLoop()


def on_input(channel, condition):
    line = channel.readline().strip()
    if not line or line == 'quit':
        loop.quit()
        return False

    def flush():
        # Signals sent before the service answers this call have been handled by the time the reply arrives
        connection.call_sync(service, '/', 'org.freedesktop.DBus.Peer', 'Ping', None, None, Gio.DBusCallFlags.NONE, 2000, None)
        GLib.idle_add(lambda: report(step=line, events=events[:], view=view()) or events.clear() or False)
        return False

    GLib.idle_add(flush)
    return True


GLib.io_add_watch(GLib.IOChannel.unix_new(sys.stdin.fileno()), GLib.IO_IN | GLib.IO_HUP, on_input)
report(ready=view())
loop.run()
