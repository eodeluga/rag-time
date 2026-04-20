type TaskRunner<Input, Output> = (input: Input, index: number) => Promise<Output>

function validateMaxConcurrency(maxConcurrency: number): void {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error('maxConcurrency must be an integer greater than 0.')
  }
}

/**
 * Runs an async task function over an array of inputs with an optional cap on concurrent executions.
 *
 * When `maxConcurrency` is omitted all tasks are started simultaneously via `Promise.all`.
 * When provided, tasks are dispatched to a fixed-size worker pool that picks up the next
 * input as soon as a slot becomes free, preserving throughput without overloading the target.
 *
 * Output order always mirrors input order regardless of task completion order.
 *
 * @param {Input[]} inputs - Values to process.
 * @param {TaskRunner<Input, Output>} taskRunner - Async function invoked with each input value
 *   and its zero-based index.
 * @param {number} [maxConcurrency] - Maximum number of tasks running simultaneously.
 *   Must be a positive integer. Omit for unlimited concurrency.
 * @returns {Promise<Output[]>} A promise resolving to task outputs in input order.
 * @throws {Error} If `maxConcurrency` is provided but is not a positive integer.
 *
 * @example
 * const results = await runWithOptionalConcurrencyLimit(
 *   urls,
 *   (url) => fetch(url).then(r => r.json()),
 *   5 // at most 5 concurrent requests
 * )
 */
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
