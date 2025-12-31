import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { jamRoutes } from "../index";

const TEST_APP_DIR = "./test-app-suite";
const ROUTES_DIR = path.join(TEST_APP_DIR, "routes");

function setupTestApp() {
    if (existsSync(TEST_APP_DIR)) {
        rmSync(TEST_APP_DIR, { recursive: true });
    }
    mkdirSync(ROUTES_DIR, { recursive: true });
}

function teardownTestApp() {
    if (existsSync(TEST_APP_DIR)) {
        rmSync(TEST_APP_DIR, { recursive: true });
    }
}

function createFile(filePath: string, content: string = "export default function Component() {}") {
    const fullPath = path.join(ROUTES_DIR, filePath);
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
}

describe("jamRoutes", () => {
    beforeEach(() => {
        setupTestApp();
    });

    afterEach(() => {
        teardownTestApp();
    });

    test("generates basic index route", async () => {
        createFile("page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        
        const indexRoute = flatRoutes.find((r: any) => r.index);
        expect(indexRoute).toBeDefined();
        expect(indexRoute.file).toBe("./routes/page.tsx");
    });

    test("generates nested routes", async () => {
        createFile("about/page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        
        const aboutRoute = flatRoutes.find((r: any) => r.path === "about");
        expect(aboutRoute).toBeDefined();

        expect(aboutRoute.children[0].file).toBe("./routes/about/page.tsx");
    });

    test("generates dynamic routes", async () => {
        createFile("users/[id]/page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        
        const userRoute = flatRoutes.find((r: any) => r.path === "users");
        expect(userRoute).toBeDefined();
        
        const idRoute = userRoute.children.find((r: any) => r.path === ":id");
        expect(idRoute).toBeDefined();
        expect(idRoute.children[0].file).toBe("./routes/users/[id]/page.tsx");
    });

    test("generates splat routes", async () => {
        createFile("files/[...path]/page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        
        const filesRoute = flatRoutes.find((r: any) => r.path === "files");
        expect(filesRoute).toBeDefined();

        const splatRoute = filesRoute.children.find((r: any) => r.path === "*path");
        
        expect(splatRoute).toBeDefined();
        expect(splatRoute.children[0].file).toBe("./routes/files/[...path]/page.tsx");
    });

    test("handles route groups (folders starting with _)", async () => {
        createFile("_auth/login/page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        

        const loginRoute = flatRoutes.find((r: any) => r.path === "login");
        expect(loginRoute).toBeDefined();
        expect(loginRoute.children[0].file).toBe("./routes/_auth/login/page.tsx");
        

        const authRoute = flatRoutes.find((r: any) => r.path === "_auth");
        expect(authRoute).toBeUndefined();
    });

    test("respects ignoredFilePatterns", async () => {
        createFile("visible/page.tsx");
        createFile("ignored/page.tsx");
        createFile("components/Button.tsx");
        
        const routes = await jamRoutes({ 
            rootDirectory: TEST_APP_DIR,
            ignoredFilePatterns: ["**/ignored/**"]
        });
        const flatRoutes = getFlatRoutes(routes);
        
        const visibleRoute = flatRoutes.find((r: any) => r.path === "visible");
        expect(visibleRoute).toBeDefined();
        
        const ignoredRoute = flatRoutes.find((r: any) => r.path === "ignored");
        expect(ignoredRoute).toBeUndefined();
    });
    
    test("handles layout routes", async () => {
        createFile("dashboard/layout.tsx");
        createFile("dashboard/page.tsx");
        
        const routes = await jamRoutes({ rootDirectory: TEST_APP_DIR });
        const flatRoutes = getFlatRoutes(routes);
        
        const dashboardRoute = flatRoutes.find((r: any) => r.path === "dashboard");
        expect(dashboardRoute).toBeDefined();
        expect(dashboardRoute.file).toBe("./routes/dashboard/layout.tsx");
        
        const indexChild = dashboardRoute.children.find((r: any) => r.index);
        expect(indexChild).toBeDefined();
        expect(indexChild.file).toBe("./routes/dashboard/page.tsx");
    });
});

// Helper to unwrap the root layout if present, to make assertions easier
function getFlatRoutes(routes: any[]) {
    if (routes.length === 1 && !routes[0].path && routes[0].children) {
        return routes[0].children;
    }
    return routes;
}
