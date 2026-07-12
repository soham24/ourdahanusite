type WriteResult = { error: { message: string } | null }
type FindActionResult = { error?: string; ok?: boolean }

interface ProfessionalInsertClient {
  from(table: 'find_professionals'): {
    insert(row: Record<string, unknown>): PromiseLike<WriteResult>
  }
}

export function createInsertProfessional(
  client: ProfessionalInsertClient,
) {
  return async (row: Record<string, unknown>): Promise<WriteResult> => {
    return client.from('find_professionals').insert(row)
  }
}

export function createRequestScopedFindActions<
  TClient,
  TProfessionalInput,
  TRatingInput,
>(
  createClient: () => Promise<TClient>,
  buildActions: (client: TClient) => {
    submitProfessional(input: TProfessionalInput): Promise<FindActionResult>
    submitRating(input: TRatingInput): Promise<FindActionResult>
  },
) {
  return {
    async submitProfessional(input: TProfessionalInput): Promise<FindActionResult> {
      const client = await createClient()
      return buildActions(client).submitProfessional(input)
    },
    async submitRating(input: TRatingInput): Promise<FindActionResult> {
      const client = await createClient()
      return buildActions(client).submitRating(input)
    },
  }
}
