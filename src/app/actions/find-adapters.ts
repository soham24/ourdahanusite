type WriteResult = { error: { message: string } | null }

interface ProfessionalInsertClient {
  from(table: 'find_professionals'): {
    insert(row: Record<string, unknown>): PromiseLike<WriteResult>
  }
}

export function createInsertProfessional(
  createClient: () => Promise<ProfessionalInsertClient>,
) {
  return async (row: Record<string, unknown>): Promise<WriteResult> => {
    const client = await createClient()
    return client.from('find_professionals').insert(row)
  }
}
