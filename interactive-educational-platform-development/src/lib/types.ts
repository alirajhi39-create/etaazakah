export type ActivityMap = Record<string, unknown>;

export type StudentRecord = {
  studentId: string;
  studentName: string;
  className: string;
  currentSlide: number;
  maxSlide: number;
  quizScore: number;
  quizTotal: number;
  activities: ActivityMap;
  completed: boolean;
  visits: number;
  lastSeenAt: string | null;
  updatedAt: string | null;
  createdAt?: string | null;
  locked?: boolean;
  pinned?: boolean;
};

export type SoundMeta = {
  soundKey: string;
  label: string;
  mimeType: string;
  fileSize: number;
  updatedAt: string | null;
  url?: string;
};

export type TeacherReport = {
  ok: boolean;
  students: StudentRecord[];
  classes: string[];
  sounds?: SoundMeta[];
  stats: {
    totalStudents: number;
    activeToday: number;
    completed: number;
    averageScore: number;
    averageProgress: number;
    pinnedNames: number;
  };
};
