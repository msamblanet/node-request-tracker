import * as dotenv from 'dotenv';
dotenv.config();

import * as Lib from "../src/index";
import LibDefault from "../src/index";

test("example test", () => {
    expect(LibDefault).toEqual("Example export");
})
