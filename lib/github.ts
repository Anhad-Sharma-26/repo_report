const GITHUB_API = "https://api.github.com";

interface GithubFile {
  path: string;
  content: string;
}

// Parses "https://github.com/owner/repo" into { owner, repo }
function parseGithubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const parts = cleaned.split("/");
  const repo = parts.pop()!;
  const owner = parts.pop()!;
  if (!owner || !repo) throw new Error("Invalid GitHub URL");
  return { owner, repo };
}

// Recursively fetches all files in a repo using the GitHub Trees API
async function fetchRepoFiles(owner: string, repo: string): Promise<GithubFile[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Get the full file tree in one API call (recursive: true)
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    throw new Error(`GitHub API error: ${treeRes.status} ${treeRes.statusText}`);
  }

  const treeData = await treeRes.json();

  // Filter to only source code files we care about
  const SUPPORTED_EXTENSIONS = [
    ".js", ".jsx", ".ts", ".tsx",
    ".py", ".java", ".go", ".rb",
    ".rs", ".cpp", ".c", ".cs",
    ".php", ".swift", ".kt"
  ];

  const sourceFiles = treeData.tree.filter((item: any) =>
    item.type === "blob" &&
    SUPPORTED_EXTENSIONS.some(ext => item.path.endsWith(ext)) &&
    item.size < 100000 // skip files over 100kb, usually generated code
  );

  // Fetch content of each file
  const files: GithubFile[] = [];

  for (const file of sourceFiles) {
    const contentRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${file.path}`,
      { headers }
    );

    if (!contentRes.ok) continue;

    const contentData = await contentRes.json();

    // GitHub returns file content as base64
    const decoded = Buffer.from(contentData.content, "base64").toString("utf-8");

    files.push({
      path: file.path,
      content: decoded,
    });
  }

  return files;
}

export { parseGithubUrl, fetchRepoFiles };
export type { GithubFile };