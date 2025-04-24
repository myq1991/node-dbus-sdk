import {Readable} from 'stream'

export function ReadLine(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject): void => {
        let bytes: any[] = []

        function readable(): void {
            while (1) {
                let buf: any = stream.read(1)
                if (!buf) return
                let b: any = buf[0]
                if (b === 0x0a) {
                    try {
                        resolve(Buffer.from(bytes))
                    } catch (error) {
                        reject(error)
                    } finally {
                        stream.removeListener('readable', readable)
                    }
                    return
                }
                bytes.push(b)
            }
        }

        stream.on('readable', readable)
    })
}
