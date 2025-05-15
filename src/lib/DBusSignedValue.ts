import { Signature } from './Signature';
import { DataType } from '../types/DataType';

export class DBusSignedValue {
    public readonly $signature: string;
    public readonly $value: any | DBusSignedValue | DBusSignedValue[];

    constructor(signature: string | DataType, value: any | DBusSignedValue | DBusSignedValue[]) {
        // 处理 signature 入参：如果是字符串则解析为 DataType，如果已经是 DataType 则直接使用
        const dataType = typeof signature === 'string'
            ? Signature.parseSignature(signature)[0] // 解析字符串并取第一个类型
            : signature;

        // 确保 dataType 是单个类型
        if (Array.isArray(dataType)) {
            throw new Error(`Expected a single type in signature, got multiple types`);
        }

        this.$signature = dataType.type; // 提取单个类型的 type 作为 $signature，始终是单一类型

        // 根据类型处理 value
        if (dataType.child && dataType.child.length > 0) {
            // 复合类型：数组、字典、结构体
            switch (dataType.type) {
                case 'a': // 数组
                    if (!Array.isArray(value)) {
                        // 对于字典数组 a{...}，支持传入对象
                        if (dataType.child[0].type === '{' && typeof value === 'object' && value !== null) {
                            const entries = Object.entries(value);
                            this.$value = entries.map(([key, val]) => {
                                // 直接使用已解析的 DataType 对象，避免重复解析
                                const keyDataType = dataType.child![0].child![0];
                                const valueDataType = dataType.child![0].child![1];
                                const keyObj = new DBusSignedValue(keyDataType, key);
                                const valObj = new DBusSignedValue(valueDataType, val);
                                // 创建一个 DBusSignedValue 表示单个字典条目 {...}
                                return new DBusSignedValue(dataType.child![0], [keyObj, valObj]);
                            });
                            break;
                        } else if (dataType.child[0].type === 'y' && Buffer.isBuffer(value)) {
                            // 对于 ay 类型，如果传入 Buffer，转换为数组并拆分
                            const arrayValue = Array.from(value);
                            this.$value = arrayValue.map(byte => new DBusSignedValue('y', byte));
                            break;
                        }
                        throw new Error(`Expected array for signature "a", got: ${typeof value}. Non-dictionary array types do not support object input except for Buffer with ay.`);
                    }
                    this.$value = value.map((item: any) => new DBusSignedValue(dataType.child![0], item));
                    break;

                case '{': // 字典（单个键值对）
                    if (dataType.child.length !== 2) {
                        throw new Error(`Dictionary signature "{}" must have exactly 2 child types`);
                    }
                    if (Array.isArray(value)) {
                        // 支持传入数组形式的键值对
                        if (value.length !== 2) {
                            throw new Error(`Expected key-value pair array of length 2 for dictionary signature "{}", got length: ${value.length}`);
                        }
                        // 检查 value 中的元素是否已经是 DBusSignedValue 类型
                        this.$value = value.map((item, index) =>
                            item instanceof DBusSignedValue
                                ? item
                                : new DBusSignedValue(dataType.child![index], item)
                        );
                    } else if (typeof value === 'object' && value !== null) {
                        // 对于单个字典条目，只取第一个键值对
                        const entries = Object.entries(value);
                        if (entries.length !== 1) {
                            throw new Error(`Expected object with exactly one key-value pair for dictionary signature "{}", got ${entries.length} pairs`);
                        }
                        const [key, val] = entries[0];
                        this.$value = [
                            new DBusSignedValue(dataType.child[0], key),
                            new DBusSignedValue(dataType.child[1], val)
                        ];
                    } else {
                        throw new Error(`Expected array or object with one key-value pair for dictionary signature "{}", got: ${typeof value}`);
                    }
                    break;

                case '(': // 结构体
                    if (!Array.isArray(value)) {
                        throw new Error(`Expected array for struct signature "()", got: ${typeof value}`);
                    }
                    if (value.length !== dataType.child.length) {
                        throw new Error(`Struct value length (${value.length}) does not match signature child length (${dataType.child.length})`);
                    }
                    this.$value = value.map((item: any, index: number) => {
                        return new DBusSignedValue(dataType.child![index], item);
                    });
                    break;

                default:
                    throw new Error(`Unsupported composite type: "${dataType.type}"`);
            }
        } else {
            // 基础类型，直接存储 value
            this.$value = value;
        }
    }
}
