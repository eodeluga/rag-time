import * as fs from 'fs'
import { it, describe, expect } from 'bun:test'

describe('Test template', function() {
  it('has a test folder', function() {
    const fileExists = fs.existsSync('./test')
    expect(fileExists).toBe(true)
  })
  
  it('tests an array', function() {
    const strArr = ['the', 'dog', 'barked'] as const
    expect(strArr).toEqual(['the', 'dog', 'barked'])
  })
})
