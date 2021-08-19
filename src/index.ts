import { config } from 'dotenv';
import { json } from 'body-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { MongoClient } from 'mongodb'

config();

const { dbURI } = process.env;

if(!dbURI) throw new Error('No database url detected on environment');

const client = new MongoClient(dbURI);

const app = express();

app.use(json());
app.use(cors());

(async () => {
	await client.connect();
	console.log('Connection with database successfully stablished');
	const db = client.db('web');
  const collection = db.collection('méxico');
  app.get('/', async (request: Request, response: Response) => {
    try {
      const { estado, municipio } = request.query;
      let resultado: any[] = [];
      if (!estado && !municipio) {
        const arreglo = await collection.aggregate<{nombre: string }>([
          {
            '$project': {
              '_id': 0,
              'nombre': 1
            }
          }
        ]).toArray();
        if (!arreglo || arreglo.length < 1) return response.status(404).send();
        resultado = arreglo.map(e => e.nombre);
      } else if (estado && !municipio) {
        const arreglo = await collection.aggregate<{ municipios: { nombre: string }[] }>([
          {
            '$match': {
              'nombre': estado
            }
          }, {
            '$project': {
              '_id': 0,
              'municipios.nombre': 1
            }
          }
        ]).toArray()
        if (!arreglo || arreglo.length < 1) return response.status(404).send();
        resultado = arreglo[0].municipios.map(m => m.nombre);
      } else {
        const arreglo = await collection.aggregate<{ municipios: { localidades: { nombre : string }[] }[] }>([
          {
            '$match': {
              'nombre': estado,
              'municipios.nombre': municipio
            }
          }, {
            '$project': {
              '_id': 0,
              'municipios.localidades.nombre': 1
            }
          }
        ]).toArray()
        if (!arreglo || arreglo.length < 1) return response.status(404).send();
        resultado = arreglo[0].municipios.flatMap(m => m.localidades.map(l => l.nombre));
      }
      response.status(200).json(resultado);
    } catch (error) {
      console.error(error);
      response.status(500);
    }
  })
})();

app.listen(3000)