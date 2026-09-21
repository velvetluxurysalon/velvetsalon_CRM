import { Schema, model, Document, Types } from 'mongoose';

export interface IEmployeeJoining extends Document {
  staffId?: string;
  dateOfJoining?: Date;

  fullName: string;
  preferredName?: string;
  mobileNumber: string;
  whatsappNumber?: string;
  dateOfBirth?: Date;
  currentAddress?: string;

  emergencyContactName: string;
  emergencyRelationship?: string;
  emergencyPhone: string;

  position: string;
  department: string;
  previousEmployer?: string;
  totalExperience?: string;
  agreedSalary?: string;
  employmentType?: string;
  probationPeriod?: string;
  weeklyOff?: string;

  skills: string[];
  strongestSkill?: string;
  trainingRequired?: string;

  documents: string[];

  aadhaarNumber?: string;
  panNumber?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;

  declarationAccepted: boolean;
  signatureName: string;
  declarationDate?: Date;

  documentsVerified?: 'yes' | 'no' | '';
  skillAssessment?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | '';
  joiningApprovedBy?: string;
  probationReviewDate?: Date;
  managerRemarks?: string;
  managerSignature?: string;

  createdBy?: Types.ObjectId;
}

const EmployeeJoiningSchema = new Schema<IEmployeeJoining>(
  {
    staffId: { type: String, trim: true },
    dateOfJoining: { type: Date },

    fullName: { type: String, required: true, trim: true },
    preferredName: { type: String, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    dateOfBirth: { type: Date },
    currentAddress: { type: String, trim: true },

    emergencyContactName: { type: String, required: true, trim: true },
    emergencyRelationship: { type: String, trim: true },
    emergencyPhone: { type: String, required: true, trim: true },

    position: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    previousEmployer: { type: String, trim: true },
    totalExperience: { type: String, trim: true },
    agreedSalary: { type: String, trim: true },
    employmentType: { type: String, trim: true },
    probationPeriod: { type: String, trim: true },
    weeklyOff: { type: String, trim: true },

    skills: { type: [String], default: [] },
    strongestSkill: { type: String, trim: true },
    trainingRequired: { type: String, trim: true },

    documents: { type: [String], default: [] },

    // select: false — Aadhaar/PAN/bank details never come back on a normal
    // find/findById unless explicitly requested with .select('+field').
    aadhaarNumber: { type: String, trim: true, select: false },
    panNumber: { type: String, trim: true, select: false },
    bankName: { type: String, trim: true, select: false },
    accountHolderName: { type: String, trim: true, select: false },
    accountNumber: { type: String, trim: true, select: false },
    ifscCode: { type: String, trim: true, select: false },

    declarationAccepted: { type: Boolean, required: true, default: false },
    signatureName: { type: String, required: true, trim: true },
    declarationDate: { type: Date },

    documentsVerified: { type: String, enum: ['yes', 'no', ''], default: '' },
    skillAssessment: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert', ''],
      default: '',
    },
    joiningApprovedBy: { type: String, trim: true },
    probationReviewDate: { type: Date },
    managerRemarks: { type: String, trim: true },
    managerSignature: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const EmployeeJoining = model<IEmployeeJoining>('EmployeeJoining', EmployeeJoiningSchema);