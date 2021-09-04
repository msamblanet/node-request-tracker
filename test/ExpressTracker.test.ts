import * as Lib from "../src/ExpressTracker";
import LibDefault from "../src/ExpressTracker";

test("Verify Exports", () => {
    expect(Lib.ExpressTracker).not.toBeNull();

    expect(LibDefault).toEqual(Lib.ExpressTracker);
})

test("Basic Function", () => {
    const t = new Lib.ExpressTracker();

    expect(t).toHaveProperty("expressMiddleware");

    let nextCalls = 0;
    let nextErrs = 0;
    const next = (x: any) => x ? nextErrs++ : nextCalls++; // eslint-disable-line @typescript-eslint/no-explicit-any
    const req = { url: "A" };
    const res = {
        getHeader: (x: unknown) => x,
        writeHead: () => 0
    }

    const mw = t.expressMiddleware;

    mw(req as any, res as any, next);// eslint-disable-line @typescript-eslint/no-explicit-any
    expect(nextCalls).toEqual(1);
    expect(nextErrs).toEqual(0);
    expect(t.status()).toMatchObject({
        completed: [],
        numPendingRequests: 1,
        numTotalRequests: 1,
        pending: [
             { desc: "A", meta: {} }
        ]
    });

    (res as any).writeHead(42);// eslint-disable-line @typescript-eslint/no-explicit-any
    expect(t.status()).toMatchObject({
        completed: [
            { desc: "A", meta: { statusCode: 42, contentType: "content-type" } }
        ],
        numPendingRequests: 0,
        numTotalRequests: 1,
        pending: []
    });

});
