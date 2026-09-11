import { analyzeUpdates } from '@/lib/agent';
import { createReviewHandler } from '@/lib/review-handler';

const handler = createReviewHandler({ analyze: analyzeUpdates });
export function GET() {
  return handler.GET();
}
export function POST(request: Request) {
  return handler.POST(request);
}
