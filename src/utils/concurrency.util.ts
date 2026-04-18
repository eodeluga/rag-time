type TaskRunner<Input, Output> = (input: Input, index: number) => Promise<Output>

function validateMaxConcurrency(maxConcurrency: number): void {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error('maxConcurrency must be an integer greater than 0.')
  }
}

export async function runWithOptionalConcurrencyLimit<Input, Output>(
  inputs: Input[],
  taskRunner: TaskRunner<Input, Output>,
  maxConcurrency?: number
): Promise<Output[]> {
  if (maxConcurrency === undefined) {
    return Promise.all(inputs.map((input, index) => taskRunner(input, index)))
  }

  validateMaxConcurrency(maxConcurrency)

  const outputByIndex: Output[] = new Array(inputs.length)
  let currentIndex = 0
  const workerCount = Math.min(maxConcurrency, inputs.length)
  const workers = new Array(workerCount).fill(null).map(() =>
    (async (): Promise<void> => {
      while (currentIndex < inputs.length) {
        const nextIndex = currentIndex
        currentIndex += 1
        outputByIndex[nextIndex] = await taskRunner(inputs[nextIndex]!, nextIndex)
      }
    })()
  )

  await Promise.all(workers)
  return outputByIndex
}
