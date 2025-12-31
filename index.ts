import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Minimatch } from "minimatch";
import {
	index,
	layout, type RouteConfigEntry,
	route
} from "@react-router/dev/routes";

// Convert route path to a safe filename (e.g., "./routes/_dashboard/account" -> "_dashboard.account")
function routePathToFileName(routePath: string): string {
	return (
		routePath
			.replace(/^\.\/routes\/?/, "")
			.replace(/\//g, ".")
			.replace(/^\.*/, "") || "root"
	);
}

interface RouteNode {
	path: string;
	filePath: string;
	type: "page" | "layout" | "route" | "not-found";
	children: RouteNode[];
	isDynamic: boolean;
	isIndex: boolean;
}

function parseFileName(fileName: string): {
	routePath: string;
	isDynamic: boolean;
	isIndex: boolean;
} {
	const name = fileName.replace(/\.(tsx|ts|jsx|js)$/, "");

	// Check for page.tsx or layout.tsx
	if (name === "page") {
		return { routePath: "", isDynamic: false, isIndex: true };
	}
	if (name === "layout") {
		return { routePath: "", isDynamic: false, isIndex: false };
	}

	// Handle catch-all routes [...param]
	if (name.startsWith("[...") && name.endsWith("]")) {
		const param = name.slice(4, -1);
		return { routePath: `*${param}`, isDynamic: true, isIndex: false };
	}

	// Handle dynamic routes [param]
	if (name.startsWith("[") && name.endsWith("]")) {
		const param = name.slice(1, -1);
		return { routePath: `:${param}`, isDynamic: true, isIndex: false };
	}

	return { routePath: name, isDynamic: false, isIndex: false };
}

async function getTempLayoutPath(routePath: string, rootDir: string): Promise<string> {
	const tempDirPath = path.join(rootDir, ".react-router/layouts");
	const fileName = `${routePathToFileName(routePath)}.layout.tsx`;
	const filePath = path.join(tempDirPath, fileName);

	if (!existsSync(tempDirPath)) {
		await mkdir(tempDirPath, { recursive: true });
	}

	const content = `import { Outlet } from "react-router";
export default function Layout() {
	return <Outlet />;
}`;

    if (!existsSync(filePath)) {
         await writeFile(filePath, content);
    }
    
	return `.react-router/layouts/${fileName}`;
}

async function buildRouteTree(rootDir: string, currentDir: string = "", ignoredMatchers: Minimatch[] = []): Promise<RouteNode[]> {
	const fullPath = path.join(rootDir, currentDir);
    const allEntries = await readdir(fullPath, { withFileTypes: true });

	const nodes: RouteNode[] = [];
    const processingPromises: Promise<RouteNode[] | void>[] = [];
    
    let layoutFile: { name: string } | undefined;

	for (const entry of allEntries) {
        const relativePath = path.join(currentDir, entry.name);
        if (ignoredMatchers.some((matcher) => matcher.match(relativePath))) {
            continue;
        }

        if (entry.isFile() && entry.name.match(/^layout\.(tsx|ts|jsx|js)$/)) {
            layoutFile = entry;
            continue;
        }

		// Skip private files/folders starting with underscore (except route groups)
		if (entry.name.startsWith("_") && !entry.isDirectory()) continue;

		if (entry.isDirectory()) {
            const folderPath = entry.name;
            processingPromises.push((async () => {
                const subNodes = await buildRouteTree(rootDir, path.join(currentDir, entry.name), ignoredMatchers);
                
                // Route group: folder starts with underscore, doesn't add to URL path
                if (folderPath.startsWith("_")) {
                    nodes.push(...subNodes);
                    return;
                }

                const { routePath, isDynamic } = parseFileName(folderPath);

                nodes.push({
                    path: routePath || folderPath,
                    filePath: "",
                    type: "route",
                    children: subNodes,
                    isDynamic,
                    isIndex: false,
                });
            })());
            
		} else if (entry.isFile() && entry.name.match(/^page\.(tsx|ts|jsx|js)$/)) {
			const filePath = path.join(currentDir, entry.name).replace(/\\/g, "/");
			nodes.push({
				path: "",
				filePath: `./${filePath}`,
				type: "page",
				children: [],
				isDynamic: false,
				isIndex: true,
			});
		} else if (entry.isFile() && entry.name.match(/^not-found\.(tsx|ts|jsx|js)$/)) {
			const filePath = path.join(currentDir, entry.name).replace(/\\/g, "/");
			nodes.push({
				path: "*",
				filePath: `./${filePath}`,
				type: "not-found",
				children: [],
				isDynamic: false,
				isIndex: false,
			});
		}
	}
    await Promise.all(processingPromises);

	// Sort nodes to ensure normal routes match before param routes
	nodes.sort((a, b) => {
		if (a.type !== "route" && b.type !== "route") return 0;
		if (a.type !== "route") return 1;
		if (b.type !== "route") return -1;
		if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1;
        return a.path < b.path ? -1 : 1;
	});

	if (layoutFile) {
		const layoutPath = path.join(currentDir, layoutFile.name).replace(/\\/g, "/");
		return [
			{
				path: "",
				filePath: `./${layoutPath}`,
				type: "layout",
				children: nodes,
				isDynamic: false,
				isIndex: false,
			},
		];
	}

	if (nodes.length > 0 && !nodes.some((node) => node.type === "layout")) {
		return [
			{
				path: "",
				// Use the current directory path for deterministic naming
				filePath: await getTempLayoutPath(currentDir || "root", rootDir),
				type: "layout",
				children: nodes,
				isDynamic: false,
				isIndex: false,
			},
		];
	}

	return nodes;
}

function convertToRouteConfig(nodes: RouteNode[]): RouteConfigEntry[] {
	const routes: RouteConfigEntry[] = [];
	const notFoundRoutes: RouteConfigEntry[] = [];

	for (const node of nodes) {
		if (node.type === "layout") {
			const children = convertToRouteConfig(node.children);
			routes.push(layout(node.filePath, children));
		} else if (node.type === "page" && node.isIndex) {
			routes.push(index(node.filePath));
		} else if (node.type === "not-found") {
			notFoundRoutes.push(route(node.path, node.filePath));
		} else if (node.type === "route") {
			const layoutNode = node.children.find((child) => child.type === "layout");
			const indexNode = node.children.find((child) => child.type === "page" && child.isIndex);
			const dynamicChildren = node.children.filter(
				(child) => child.type === "route" && child.isDynamic,
			);
			const otherChildren = node.children.filter(
				(child) =>
					child !== layoutNode && child !== indexNode && !dynamicChildren.includes(child),
			);

			if (layoutNode) {
				const layoutChildren = convertToRouteConfig(
					layoutNode.children.concat(otherChildren),
				);
				routes.push(route(node.path, layoutNode.filePath, layoutChildren));
			} else if (indexNode) {
				const nestedRoutes = convertToRouteConfig(otherChildren);
				routes.push(route(node.path, indexNode.filePath, nestedRoutes));
			} else {
				routes.push(...convertToRouteConfig(otherChildren));
			}


			for (const dynamicChild of dynamicChildren) {
				const childPath =
					node.path === "" ? dynamicChild.path : `${node.path}/${dynamicChild.path}`;
				const childLayout = dynamicChild.children.find((c) => c.type === "layout");
				const childIndex = dynamicChild.children.find(
					(c) => c.type === "page" && c.isIndex,
				);
				const childOther = dynamicChild.children.filter(
					(c) => c !== childLayout && c !== childIndex,
				);
				if (childLayout) {
					const childNested = convertToRouteConfig(
						childLayout.children.concat(childOther),
					);
					routes.push(route(childPath, childLayout.filePath, childNested));
				} else if (childIndex) {
					const childNested = convertToRouteConfig(childOther);
					routes.push(route(childPath, childIndex.filePath, childNested));
				} else {
					routes.push(...convertToRouteConfig(childOther));
				}
			}
		}
	}


	routes.push(...notFoundRoutes);

	return routes;
}

export interface JamRoutesOptions {
	/**
	 * The root directory of the Remix/React Router app.
	 * @default "./app"
	 */
	rootDirectory?: string;
    /**
     * The file patterns to ignore when looking for routes.
     * Use glob patterns supported by `minimatch`.
     * @default []
     */
    ignoredFilePatterns?: string[];
}

export async function jamRoutes(options: JamRoutesOptions = {}) {
    const { rootDirectory = "./app", ignoredFilePatterns = [] } = options;
    const ignoredMatchers = ignoredFilePatterns.map(pattern => new Minimatch(pattern));
    
    const tree = await buildRouteTree(rootDirectory, "routes", ignoredMatchers);
	return convertToRouteConfig(tree);
} 
