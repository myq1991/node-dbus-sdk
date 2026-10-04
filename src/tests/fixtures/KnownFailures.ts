/**
 * Which check of a matrix case: encoding or decoding per byte order, or encoding an alternative input form (by its name).
 */
export type MatrixCheck = string

export interface KnownFailureGroup {
    reason: string
    /**
     * Entries are `<check> | <case id>` for matrix cases in wire-matrix.json.
     */
    failures: string[]
}

/**
 * Matrix cases that currently fail, grouped by the defect causing them.
 * After fixing a defect, delete its group and run the tests: anything still failing was not fixed.
 */
export const KnownFailureGroups: KnownFailureGroup[] = []

const index: Map<string, string> = new Map()
KnownFailureGroups.forEach((group: KnownFailureGroup): void => group.failures.forEach((failure: string): void => {
    index.set(failure, index.has(failure) ? `${index.get(failure)}; ${group.reason}` : group.reason)
}))

/**
 * Looks up why a matrix case is known to fail for the given check.
 *
 * @param caseId - Case id from wire-matrix.json.
 * @param check - Which check failed.
 * @returns The defect description, or undefined if the case is expected to pass.
 */
export function knownFailure(caseId: string, check: MatrixCheck): string | undefined {
    return index.get(`${check} | ${caseId}`)
}

const CODEC_CHECKS: string[] = ['encode le', 'encode be', 'decode le', 'decode be']

/**
 * All defects known to break encoding or decoding of a matrix case in its default input form, which is what the
 * interop tests send (failures of the alternative input forms do not affect them).
 *
 * @param caseId - Case id from wire-matrix.json.
 * @returns Distinct defect descriptions, empty if the codec handles the case correctly.
 */
export function knownCodecFailures(caseId: string): string[] {
    const reasons: Set<string> = new Set()
    KnownFailureGroups.forEach((group: KnownFailureGroup): void => {
        if (group.failures.some((failure: string): boolean => CODEC_CHECKS.some((check: string): boolean => failure === `${check} | ${caseId}`))) reasons.add(group.reason)
    })
    return [...reasons]
}
