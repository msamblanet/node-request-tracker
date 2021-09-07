import type Express from "express";
import type OnHeaders from "on-headers";
import { RequestTracker, RequestTrackerConfigOverride } from "./RequestTracker";
import { optionalRequire } from "optional-require";

export type ExpressTrackerMetadata = {
    statusCode?: number | undefined
    contentType?: string | undefined
};

export class ExpressTracker extends RequestTracker<ExpressTrackerMetadata> {
    private readonly onHeaders: typeof OnHeaders

    public constructor(...config: RequestTrackerConfigOverride[]) {
        super(...config);

        const t = optionalRequire("on-headers");
        /* istanbul ignore next */
        if (!t) throw new Error("Missing optional dependency required for ExpressTracker: on-headers");
        this.onHeaders = t;
    }

    public expressMiddleware = (req: Express.Request, res: Express.Response, next: Express.NextFunction): void => {
        try {
            const meta: ExpressTrackerMetadata = {};
            const trackedRequest = this.request(req.url, meta);
            this.onHeaders(res, () => {
                // Mark as completed when we send headers
                meta.statusCode = res.statusCode;
                meta.contentType = res.getHeader("content-type") as string;
                this.completeRequest(trackedRequest);
            });

            // Continue with our processing...
            next();

        }

        catch (err) /* istanbul ignore next */ {
            next(err);
        }
    }
}
export default ExpressTracker;
