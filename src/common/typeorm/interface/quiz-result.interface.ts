import { QuestionAttempt } from "../entities/question-attempt.entity";

export interface IQuizResult {
    id:number
    resultCode: string
    userId: number
    quizId: number
    total: number
    correct: number
    wrong: number
    unanswered: number
    timeSpent: number
    score: number
    //by default take all topics in the subject - heavy
    //Also allow user to pick at time of creation
    //refresh topics list after the quiz is generated for better skill filtering
    remarks?: string
  createdAt: Date;
    //attempts?: QuestionAttempt[]
    attempts?: QuestionAttempt[]
    feedback?: string
    device?: string
    client?: string
    ipAddress?: string
  }