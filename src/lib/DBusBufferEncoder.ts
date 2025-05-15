import {DBusMessageEndianness} from './DBusMessageEndianness'
import {ObjectPathError, SignatureError} from './Errors'

export class DBusBufferEncoder {

    public readonly endianness: DBusMessageEndianness = DBusMessageEndianness.BE

    protected buffer: Buffer

    /**
     * 构造函数
     * @param initBuffer
     * @param alignment
     */
    constructor(initBuffer?: Buffer, alignment?: number) {
        this.buffer = initBuffer ? initBuffer : Buffer.alloc(0)
        if (alignment) this.align(alignment)
    }

    /**
     * 数据对齐
     * @param alignment
     * @protected
     */
    protected align(alignment: number): this {
        const remainder: number = this.buffer.length % alignment
        if (remainder === 0) return this // 已经对齐，无需操作
        const padding: number = alignment - remainder
        const paddingBuffer: Buffer = Buffer.alloc(padding, 0) // 用 0 填充
        this.buffer = Buffer.concat([this.buffer, paddingBuffer]) // 填充字节追加在原缓冲区的后部
        return this
    }

    /**
     * 编码BYTE类型数据
     * 使用前需要对之前的Buffer进行1字节对齐
     * @param value
     */
    public writeByte(value: number): this {
        this.align(1)
        const buffer: Buffer = Buffer.alloc(1)
        buffer.writeUInt8(value & 0xFF, 0) // 确保值在 0-255 范围内
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码BOOLEAN类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param value
     */
    public writeBoolean(value: boolean): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // BOOLEAN 类型占用 4 字节
        const intValue: 0 | 1 = value ? 1 : 0 // true 编码为 1，false 编码为 0
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(intValue, 0) // 小端字节序
        } else {
            buffer.writeUInt32BE(intValue, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码INT16类型数据
     * 使用前需要对之前的Buffer进行2字节对齐
     * @param value
     */
    public writeInt16(value: number): this {
        this.align(2)
        const buffer: Buffer = Buffer.alloc(2) // INT16 类型占用 2 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeInt16LE(value, 0) // 小端字节序
        } else {
            buffer.writeInt16BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码UINT16类型数据
     * 使用前需要对之前的Buffer进行2字节对齐
     * @param value
     */
    public writeUInt16(value: number): this {
        this.align(2)
        const buffer: Buffer = Buffer.alloc(2) // UINT16 类型占用 2 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt16LE(value, 0) // 小端字节序
        } else {
            buffer.writeUInt16BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码INT32类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param value
     */
    public writeInt32(value: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // INT32 类型占用 4 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeInt32LE(value, 0) // 小端字节序
        } else {
            buffer.writeInt32BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码UINT32类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param value
     */
    public writeUInt32(value: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // UINT32 类型占用 4 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(value, 0) // 小端字节序
        } else {
            buffer.writeUInt32BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码INT64类型数据
     * 使用前需要对之前的Buffer进行8字节对齐
     * @param value
     */
    public writeInt64(value: bigint): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // INT64 类型占用 8 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeBigInt64LE(value, 0) // 小端字节序
        } else {
            buffer.writeBigInt64BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码UINT64类型数据
     * 使用前需要对之前的Buffer进行8字节对齐
     * @param value
     */
    public writeUInt64(value: bigint): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // UINT64 类型占用 8 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeBigUInt64LE(value, 0) // 小端字节序
        } else {
            buffer.writeBigUInt64BE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码DOUBLE类型数据
     * 使用前需要对之前的Buffer进行8字节对齐
     * @param value
     */
    public writeDouble(value: number): this {
        this.align(8)
        const buffer: Buffer = Buffer.alloc(8) // DOUBLE 类型占用 8 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeDoubleLE(value, 0) // 小端字节序
        } else {
            buffer.writeDoubleBE(value, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码UNIX_FD类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param fdIndex
     */
    public writeUnixFD(fdIndex: number): this {
        this.align(4)
        const buffer: Buffer = Buffer.alloc(4) // UNIX_FD 类型占用 4 字节
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(fdIndex, 0) // 小端字节序
        } else {
            buffer.writeUInt32BE(fdIndex, 0) // 大端字节序
        }
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码STRING类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param value
     */
    public writeString(value: string): this {
        this.align(4)
        const stringBuffer: Buffer = Buffer.from(value, 'utf8') // 将字符串转换为 UTF-8 编码的字节缓冲区
        const length: number = stringBuffer.length // 获取字符串的字节长度
        const totalLength: number = 4 + length + 1 // 4 字节长度字段 + 字符串内容 + 1 字节空终止符
        const buffer: Buffer = Buffer.alloc(totalLength) // 分配总长度的缓冲区
        // 写入长度字段（32 位无符号整数）
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(length, 0) // 小端字节序
        } else {
            buffer.writeUInt32BE(length, 0) // 大端字节序
        }
        // 写入字符串内容
        stringBuffer.copy(buffer, 4) // 从偏移量 4 开始写入字符串内容
        // 写入末尾的空字节
        buffer.writeUInt8(0, 4 + length) // 在字符串内容后写入空终止符
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码OBJECT_PATH类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     * @param value
     */
    public writeObjectPath(value: string): this {
        // 校验对象路径是否符合 DBus 规范的格式
        const objectPathRegex: RegExp = /^\/([a-zA-Z_][a-zA-Z0-9_]*)*(?:\/([a-zA-Z_][a-zA-Z0-9_]*))*$|^\/$/
        if (!objectPathRegex.test(value)) throw new ObjectPathError(`Invalid DBus object path: "${value}". Object path must start with '/' and consist of elements separated by '/', where each element starts with a letter or underscore and contains only letters, numbers, or underscores.`)
        this.align(4)
        const pathBuffer: Buffer = Buffer.from(value, 'utf8') // 将路径转换为 UTF-8 编码的字节缓冲区
        const length: number = pathBuffer.length // 获取路径的字节长度
        const totalLength: number = 4 + length + 1 // 4 字节长度字段 + 路径内容 + 1 字节空终止符
        const buffer: Buffer = Buffer.alloc(totalLength) // 分配总长度的缓冲区
        // 写入长度字段（32 位无符号整数）
        if (this.endianness === DBusMessageEndianness.LE) {
            buffer.writeUInt32LE(length, 0) // 小端字节序
        } else {
            buffer.writeUInt32BE(length, 0) // 大端字节序
        }
        // 写入路径内容
        pathBuffer.copy(buffer, 4) // 从偏移量 4 开始写入路径内容
        // 写入末尾的空字节
        buffer.writeUInt8(0, 4 + length) // 在路径内容后写入空终止符
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码SIGNATURE类型数据
     * 使用前需要对之前的Buffer进行1字节对齐
     * @param value
     */
    public writeSignature(value: string): this {
        this.align(1)
        const signatureBuffer: Buffer = Buffer.from(value, 'utf8') // 将签名字符串转换为 UTF-8 编码的字节缓冲区
        const length: number = signatureBuffer.length // 获取签名字符串的字节长度
        // 校验长度是否超过 255 字节（SIGNATURE 长度字段是 8 位无符号整数）
        if (length > 255) throw new SignatureError(`DBus signature length exceeds maximum of 255 bytes: "${value}"`)
        const totalLength: number = 1 + length + 1 // 1 字节长度字段 + 签名内容 + 1 字节空终止符
        const buffer: Buffer = Buffer.alloc(totalLength) // 分配总长度的缓冲区
        // 写入长度字段（8 位无符号整数）
        buffer.writeUInt8(length, 0)
        // 写入签名字符串内容
        signatureBuffer.copy(buffer, 1) // 从偏移量 1 开始写入签名内容
        // 写入末尾的空字节
        buffer.writeUInt8(0, 1 + length) // 在签名内容后写入空终止符
        this.buffer = Buffer.concat([this.buffer, buffer])
        return this
    }

    /**
     * 编码基础类型数据
     * @param type
     * @param value
     */
    public writeSimpleType(type: string, value: any): this {
        switch (type) {
            case 'y':
                return this.writeByte(value)
            case 'b':
                return this.writeBoolean(value)
            case 'n':
                return this.writeInt16(value)
            case 'q':
                return this.writeUInt16(value)
            case 'u':
                return this.writeUInt32(value)
            case 'i':
                return this.writeInt32(value)
            case 'g':
                return this.writeSignature(value)
            case 's':
                return this.writeString(value)
            case 'o':
                return this.writeObjectPath(value)
            case 'x':
                return this.writeInt64(BigInt(value))
            case 't':
                return this.writeUInt64(BigInt(value))
            case 'd':
                return this.writeDouble(value)
            default:
                throw new SignatureError(`Unsupported type: ${type}`)
        }
    }

    /**
     * 编码数组类型数据
     * 使用前需要对之前的Buffer进行4字节对齐
     */
    public writeArray(): this {
        this.align(4)
        //TODO 看起来不能单独拎出来进行编码
        return this
    }

    /**
     * 编码结构类型数据
     * 使用前需要对之前的Buffer进行8字节对齐
     */
    public writeStruct(): this {
        this.align(8)
        //TODO
        return this
    }

    /**
     * 编码变量数据
     * 使用前需要对之前的Buffer进行1字节对齐
     */
    public writeVariant(): this {
        this.align(1)
        //TODO
        return this
    }

    /**
     * 编码字典数据
     * 使用前需要对之前的Buffer进行8字节对齐
     */
    public writeDictEntry(): this {
        this.align(8)
        //TODO
        return this
    }

    public write(): this {
        //TODO
        return this
    }

    public encode() {

    }
}