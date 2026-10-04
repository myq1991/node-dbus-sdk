#!/usr/bin/env python3
"""
A GDBus service that echoes its arguments back, used as an independent peer in the integration tests.

    python3 echo_service.py <bus address> <wire-matrix.json>

Owns org.example.GDBusEcho and exports /org/example/Echo with interface org.example.Echo, which has one method per
signature in the matrix (names from its "echoMethods"), each taking and returning that signature's arguments.
It also has GetFd, which returns a real file descriptor. Prints READY once the name is owned.
"""
import json
import os
import sys

import gi

gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib  # noqa: E402

SERVICE_NAME = 'org.example.GDBusEcho'
OBJECT_PATH = '/org/example/Echo'
INTERFACE = 'org.example.Echo'


def split_signature(signature):
    types, index = [], 0
    while index < len(signature):
        end = complete_type_end(signature, index)
        types.append(signature[index:end])
        index = end
    return types


def complete_type_end(signature, index):
    c = signature[index]
    if c == 'a':
        return complete_type_end(signature, index + 1)
    if c in '({':
        closing = ')' if c == '(' else '}'
        index += 1
        while signature[index] != closing:
            index = complete_type_end(signature, index)
        return index + 1
    return index + 1


def introspection_xml(echo_methods):
    methods = []
    for signature, name in echo_methods.items():
        args = ''.join(f'<arg direction="in" type="{t}"/>' for t in split_signature(signature))
        args += ''.join(f'<arg direction="out" type="{t}"/>' for t in split_signature(signature))
        methods.append(f'<method name="{name}">{args}</method>')
    # GetFd returns a real file descriptor (the read end of a pipe) as UNIX_FD
    methods.append('<method name="GetFd"><arg direction="out" type="h"/></method>')
    return f'<node><interface name="{INTERFACE}">{"".join(methods)}</interface></node>'


def main():
    address, matrix_file = sys.argv[1], sys.argv[2]
    with open(matrix_file, encoding='utf-8') as source:
        echo_methods = json.load(source)['echoMethods']
    node = Gio.DBusNodeInfo.new_for_xml(introspection_xml(echo_methods))
    connection = Gio.DBusConnection.new_for_address_sync(
        address,
        Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION,
        None, None)

    def on_call(_connection, _sender, _path, _interface, method, parameters, invocation):
        if method == 'GetFd':
            read_end, _write_end = os.pipe()
            fd_list = Gio.UnixFDList.new_from_array([read_end])
            invocation.return_value_with_unix_fd_list(GLib.Variant('(h)', (0,)), fd_list)
            return
        invocation.return_value(parameters)

    connection.register_object(OBJECT_PATH, node.interfaces[0], on_call, None, None)
    reply = connection.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'RequestName',
                                 GLib.Variant('(su)', (SERVICE_NAME, 4)), None, Gio.DBusCallFlags.NONE, -1, None)
    if reply.unpack()[0] != 1:
        sys.exit(f'could not own {SERVICE_NAME}')
    print('READY', flush=True)
    connection.connect('closed', lambda *_: loop.quit())
    loop = GLib.MainLoop()
    loop.run()


if __name__ == '__main__':
    main()
