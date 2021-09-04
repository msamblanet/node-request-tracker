import * as Lib from "../src/index";
import LibDefault from "../src/index";

test("Verify Exports", () => {
    expect(Lib.RequestTracker).not.toBeNull();
    expect(Lib.ExpressTracker).not.toBeNull();

    expect(LibDefault).toEqual(Lib.RequestTracker);

})
