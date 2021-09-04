import type Express from "express";
import { RequestTracker, RequestTrackerConfigOverrides } from "./RequestTracker";
import { optionalRequire } from "optional-require";

export type ExpressTrackerMetadata = {
    statusCode?: number | undefined
    contentType?: string | undefined
};

export class ExpressTracker extends RequestTracker<ExpressTrackerMetadata> {
    private readonly onHeaders

    public constructor(...options: RequestTrackerConfigOverrides[]) {
        super(...options);

        const t = optionalRequire("on-Headers");
        if (!t) throw new Error("Missing optional dependency required for ExpressTracker: on-headers");
        this.onHeaders = t;
    }

    public expressMiddleware = (req: Express.Request, res: Express.Response, next: Express.NextFunction): void => {
        try {
            const trackedRequest = this.request(req.url, {});
            this.onHeaders(res, (meta: ExpressTrackerMetadata) => {
                // Mark as completed when we send headers
                meta.statusCode = res.statusCode;
                meta.contentType = res.getHeader("content-type") as string;
                this.completeRequest(trackedRequest);
            });

            // Continue with our processing...
            next();

        } catch (err) {
            next(err);
        }
    }
}
export default ExpressTracker;
