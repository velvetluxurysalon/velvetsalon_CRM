import mongoose, { Document, Schema } from 'mongoose';

export interface IServiceConsumable {
  productName: string;
  quantity: number;
  unit: string;
}

export interface IServiceMap extends Document {
  serviceId: string;
  serviceName: string;
  consumables: IServiceConsumable[];
}

const consumableSchema = new Schema<IServiceConsumable>(
  {
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.1 },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const serviceMapSchema = new Schema<IServiceMap>(
  {
    serviceId: { type: String, required: true, unique: true },
    serviceName: { type: String, required: true },
    consumables: { type: [consumableSchema], default: [] },
  },
  { timestamps: true }
);

export const ServiceMap = mongoose.model<IServiceMap>('ServiceMap', serviceMapSchema);