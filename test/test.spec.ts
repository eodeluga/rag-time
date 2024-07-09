import { describe, it, expect } from 'bun:test'
import * as fs from 'fs'

describe('Test template', function() {
  it('has a test folder', function() {
    const fileExists = fs.existsSync('./test')
    expect(fileExists).toBe(true)
  })
  
  it('tests an array', function() {
    const strArr = ['the', 'dog', 'barked']
    expect(strArr).toEqual(expect.arrayContaining(['the', 'dog', 'barked']))
  })
})
