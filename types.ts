
export type Role = 'core_admin' | 'admin' | 'volunteer';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In real app, this would be hashed
  role: Role;
  title?: string; // Used for "Remarks" now
  isApproved: boolean; // For new admins
  totalServiceCount: number;
  consecutiveMonths: number;
  phone?: string;
  notes?: string;
}

export interface EventSeries {
  id: string;
  name: string;
  color: string;
}

export interface MinistryEvent {
  id: string;
  seriesId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm (Start of first day)
  location: string;
  mealsConfig: { date: string; breakfast: boolean; lunch: boolean; dinner: boolean }[];
  isRegistrationOpen: boolean;
  registrationDeadline: string;
  remarks?: string;
  isReportDownloaded?: boolean;
}

export interface AdminTask {
  id: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  isArchived: boolean;
}

export interface Signup {
  id: string;
  eventId: string;
  volunteerId: string;
  attendingDays: string[]; // Array of YYYY-MM-DD
  meals: { date: string; type: 'breakfast' | 'lunch' | 'dinner' }[];

  // Transport
  transportMode: 'shuttle' | 'self'; // Removed public

  // Arrival (Go)
  arrivalLocation?: 'Zaoqiao' | 'Zhunan' | 'HSR_Miaoli';
  arrivalDate?: string;
  arrivalTime?: string;

  // Departure (Return)
  departureMode?: 'shuttle' | 'self';
  departureLocation?: 'Zaoqiao' | 'Zhunan' | 'HSR_Miaoli';
  departureDate?: string;
  departureTime?: string;

  notes?: string;
  submissionDate: string; // For sorting
}

export interface ShuttleGroup {
  id: string; // Unique ID for keying driver selection
  type: 'arrival' | 'departure';
  date: string;
  location: string;
  windowStart: string;
  windowEnd: string;
  suggestedDeparture: string;
  passengers: { name: string; phone: string; time: string }[];
}

export interface EmailLog {
  id: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  sentAt: string;
  status: 'sent' | 'failed';
}
