import {hex} from '../helpers/Hex'

export interface LibdbusMessageFixture {
    name: string
    /**
     * The dbus-send command line that produced this message.
     */
    command: string
    signature: string
    /**
     * Raw message bytes as delivered by dbus-daemon (captured with `dbus-monitor --binary`).
     */
    raw: Buffer
    /**
     * Body values as this library should present them after decoding.
     */
    body: any[]
    /**
     * Set when encoding `body` is known not to reproduce libdbus' bytes; describes the defect.
     */
    encodeBug?: string
    /**
     * Set when decoding `raw` is known to be wrong; describes the defect.
     */
    decodeBug?: string
}

/**
 * Reference messages encoded by libdbus (dbus-send 1.16 via dbus-daemon), captured with `dbus-monitor --binary`.
 * They are the ground truth for wire-format conformance: decoding them must yield `body`,
 * and encoding `body` with `signature` must reproduce the message body byte-for-byte.
 */
export const LibdbusMessages: LibdbusMessageFixture[] = [
    {
        name: 'basic types',
        command: 'dbus-send --type=signal /test test.Golden.Basic byte:1 boolean:true int16:-2 uint16:3 int32:-4 uint32:5 int64:-6 uint64:7 double:1.5 string:hello objpath:/a/b',
        signature: 'ybnqiuxtdso',
        raw: hex('6c04010145000000020000005d00000001016f00050000002f74657374000000020173000b000000746573742e476f6c64656e000000000003017300050000004261736963000000080167000b79626e716975787464736f000000000000000007017300040000003a312e31000000000100000001000000feff0300fcffffff0500000000000000faffffffffffffff0700000000000000000000000000f83f0500000068656c6c6f000000040000002f612f6200'),
        body: [1, true, -2, 3, -4, 5, -6n, 7n, 1.5, 'hello', '/a/b']
    },
    {
        name: 'arrays of 8-byte aligned and other types',
        command: 'dbus-send --type=signal /test test.Golden.Arrays array:int64:1,2 array:double:0.5 array:string:x,yz array:byte:1,2,3',
        signature: 'axadasay',
        raw: hex('6c04010143000000020000005500000001016f00050000002f74657374000000020173000b000000746573742e476f6c64656e0000000000030173000600000041727261797300000801670008617861646173617900000007017300040000003a312e32000000001000000000000000010000000000000002000000000000000800000000000000000000000000e03f0f000000010000007800000002000000797a000003000000010203'),
        body: [[1n, 2n], [0.5], ['x', 'yz'], Buffer.from([1, 2, 3])]
    },
    {
        name: 'dictionary and variant',
        command: 'dbus-send --type=signal /test test.Golden.Dict byte:9 dict:string:int64:k,1,m,2 variant:int64:7',
        signature: 'ya{sx}v',
        raw: hex('6c04010138000000020000005500000001016f00050000002f74657374000000020173000b000000746573742e476f6c64656e000000000003017300040000004469637400000000080167000779617b73787d760000000007017300040000003a312e33000000000900000020000000010000006b0000000100000000000000010000006d000000020000000000000001780000000000000700000000000000'),
        body: [9, {k: 1n, m: 2n}, 7n]
    },
    {
        name: 'empty containers',
        command: 'dbus-send --type=signal /test test.Golden.Empty byte:9 array:int64: dict:string:string:',
        signature: 'yaxa{ss}',
        raw: hex('6c04010110000000020000005500000001016f00050000002f74657374000000020173000b000000746573742e476f6c64656e00000000000301730005000000456d7074790000000801670008796178617b73737d00000007017300040000003a312e340000000009000000000000000000000000000000'),
        body: [9, [], {}]
    }
]
