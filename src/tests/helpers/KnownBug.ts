/**
 * Marks a test as documenting a known, not yet fixed defect.
 * The test still runs and its failure is reported as TODO without failing the suite.
 * Once the defect is fixed the test starts passing; remove the marker then so it guards against regressions.
 *
 * @param description - Short description of the defect.
 * @returns node:test options marking the test as todo.
 */
export function knownBug(description: string): { todo: string } {
    return {todo: `KNOWN BUG: ${description}`}
}
