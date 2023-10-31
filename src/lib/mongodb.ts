import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env'
  );
}

if (!process.env.MONGODB_DATABASE) {
  throw new Error(
    'Please define the MONGODB_DATABASE environment variable inside .env'
  );
}

const url = process.env.MONGODB_URI;
const database = process.env.MONGODB_DATABASE;

const createClientPromise = async (): Promise<MongoClient> => {
  const client = new MongoClient(url);
  return client.connect();
};

const clientPromise = createClientPromise();
export const dbPromise = clientPromise.then(client => client.db(database));
