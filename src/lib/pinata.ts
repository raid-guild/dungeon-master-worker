import PinataSDK, { PinataPinOptions } from '@pinata/sdk';
import { Readable } from 'stream';

import { PINATA_JWT } from '@/utils/constants';

const bufferToStream = (buffer: Buffer) => {
  const readable = new Readable();
  // eslint-disable-next-line no-underscore-dangle
  readable._read = () => undefined;
  readable.push(buffer);
  readable.push(null);
  return readable;
};

export const uploadToPinata = async (
  file: Buffer,
  fileName: string
): Promise<string> => {
  try {
    if (!PINATA_JWT) {
      throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
    }

    const pinata = new PinataSDK({ pinataJWTKey: PINATA_JWT });
    const readableStreamForFile = bufferToStream(file);
    const options: PinataPinOptions = {
      pinataMetadata: {
        name: fileName
      }
    };

    const response = await pinata.pinFileToIPFS(readableStreamForFile, options);
    const { IpfsHash } = response;
    if (!IpfsHash) {
      throw new Error('Error pinning file to IPFS');
    }

    return IpfsHash;
  } catch (error) {
    console.error(error);
    return '';
  }
};
