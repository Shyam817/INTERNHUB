export type Role = 'student' | 'mentor';
export type Domain = 'Web Dev' | 'Cybersecurity' | 'Cloud Computing';
export type SubmissionStatus = 'submitted' | 'reviewed';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  role: Role;
  domain: Domain;
  score: number;
  tasks_completed: number;
  isVerified: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  domain: Domain;
  deadline: string;
  mentor: string;
}

export interface Submission {
  id: string;
  taskId: string;
  taskTitle: string;
  studentId: string;
  fileUrl: string;
  notes: string;
  status: SubmissionStatus;
  score: number | null;
}

export interface Review {
  id: string;
  submissionId: string;
  taskTitle: string;
  reviewerId: string;
  ratings: {
    quality: number;
    creativity: number;
    completion: number;
    presentation: number;
  };
  feedback: string;
  status: 'pending' | 'completed';
}

export interface ChatMessage {
  id: string;
  name: string;
  avatar: string;
  color: string;
  text: string;
  time: string;
  isMe: boolean;
  domain: Domain;
}
