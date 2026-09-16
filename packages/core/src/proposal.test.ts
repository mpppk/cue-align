import { Result } from '@praha/byethrow'
import { ErrorFactory } from '@praha/error-factory'
import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import { InvalidAlignmentProposalError, UnknownCueIdError } from './errors'
import type { RequestAlignmentProposalError } from './errors'
import { parseAlignmentProposal, requestAlignmentProposal } from './proposal'
import type { AlignmentProposalProvider } from './proposal'
import { createAlignmentSession } from './session'
import { asCueId, asTimelinePosition } from './types'
import type { Alignment, Cue, TimelinePosition } from './types'

class TestProviderError extends ErrorFactory({
  name: 'TestProviderError',
  message: 'Proposal provider failed',
}) {}

type TestCue = Cue & { label: string }

const cues: ReadonlyArray<TestCue> = [
  { id: asCueId('a'), label: 'Alpha' },
  { id: asCueId('b'), label: 'Beta' },
  { id: asCueId('c'), label: 'Gamma' },
]

const position = (value: number): TimelinePosition => asTimelinePosition(value)

const partialProvider: AlignmentProposalProvider<
  { mediaId: string },
  TestProviderError
> = {
  propose: async () =>
    Result.succeed({
      version: 1,
      marks: [
        { cueId: 'a', at: 1.25 },
        { cueId: 'c', at: 4.5 },
      ],
    }),
}

describe('alignment proposals', () => {
  it('exposes a provider-independent async Result boundary', () => {
    expectTypeOf(
      requestAlignmentProposal(cues, partialProvider, { mediaId: 'demo' }),
    ).toEqualTypeOf<
      Result.ResultAsync<
        Alignment,
        RequestAlignmentProposalError<TestProviderError>
      >
    >()
  })

  it('accepts partial proposals and makes them editable through the normal session', async () => {
    const proposal = await requestAlignmentProposal(cues, partialProvider, {
      mediaId: 'demo',
    })
    if (Result.isFailure(proposal)) {
      throw proposal.error
    }

    expect(proposal.value).toEqual({
      version: 1,
      marks: [
        { cueId: 'a', at: 1.25 },
        { cueId: 'c', at: 4.5 },
      ],
    })

    const sessionResult = createAlignmentSession({
      cues,
      alignment: proposal.value,
    })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    expect(sessionResult.value.mark(asCueId('b'), position(3))).toBeSuccess()
    expect(sessionResult.value.getAlignment()).toEqual({
      version: 1,
      marks: [
        { cueId: 'a', at: 1.25 },
        { cueId: 'b', at: 3 },
        { cueId: 'c', at: 4.5 },
      ],
    })
  })

  it('returns a typed error for structurally malformed provider output', () => {
    const result = parseAlignmentProposal(cues, {
      version: 1,
      marks: [{ cueId: 'a', at: '1.25' }],
    })

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InvalidAlignmentProposalError)
      if (error instanceof InvalidAlignmentProposalError) {
        expect(error.path).toBe('$.marks[0].at')
      }
    })
  })

  it('applies normal domain validation to provider output', () => {
    const result = parseAlignmentProposal(cues, {
      version: 1,
      marks: [{ cueId: 'missing', at: 1 }],
    })

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(UnknownCueIdError)
    })
  })

  it('preserves typed provider failures', async () => {
    const provider: AlignmentProposalProvider<void, TestProviderError> = {
      propose: async () => Result.fail(new TestProviderError()),
    }

    const result = await requestAlignmentProposal(cues, provider, undefined)

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(TestProviderError)
    })
  })
})
