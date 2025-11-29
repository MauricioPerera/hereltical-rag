# Contributing to Hierarchical RAG

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hereltical-rag.git
   cd hereltical-rag
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates
- `perf/` - Performance improvements

### 2. Make Your Changes

- Write clear, readable code
- Follow existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check TypeScript compilation
npx tsc --noEmit

# Run the demo script
npm start
```

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add hybrid search capability"
```

**Commit message format:**
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions/updates
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat: add OpenAI embedding support

- Implement OpenAI API integration
- Add batch processing for efficiency
- Update configuration system

Closes #123
```

```
fix: resolve SQLite lock issue on Windows

Added delays to prevent concurrent access to database
during test cleanup.

Fixes #456
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Reference to related issues
- Screenshots (if applicable)

## Code Style

### TypeScript

- Use **strict mode** (`"strict": true` in tsconfig.json)
- Prefer **interfaces** over types for object shapes
- Use **async/await** over callbacks
- Document complex functions with JSDoc comments

**Example:**
```typescript
/**
 * Retrieves hierarchical context for a node
 * @param docId - Document identifier
 * @param nodeId - Node identifier
 * @returns Promise resolving to context string
 */
export async function retrieveContext(
  docId: string,
  nodeId: string
): Promise<string> {
  // Implementation
}
```

### Formatting

We use the default TypeScript formatting. Before committing:

```bash
# Format code (if you have prettier configured)
npx prettier --write "src/**/*.ts"
```

### Naming Conventions

- **Files**: camelCase (e.g., `vectorStore.ts`)
- **Classes**: PascalCase (e.g., `EmbeddingService`)
- **Functions**: camelCase (e.g., `retrieveContext`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RESULTS`)
- **Interfaces**: PascalCase (e.g., `SectionNode`)

## Testing

### Writing Tests

- Use **Vitest** for testing
- Place tests in `tests/` directory
- Name test files `*.test.ts`
- Aim for high coverage of new code

**Example test:**
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule.js';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should handle valid input', () => {
      const result = myFunction('valid');
      expect(result).toBe('expected');
    });

    it('should throw on invalid input', () => {
      expect(() => myFunction(null)).toThrow();
    });
  });
});
```

### Test Guidelines

- **One assertion per test** when possible
- **Descriptive test names** that explain what's being tested
- **Clean up** resources in `afterEach`
- **Isolate tests** - no dependencies between tests
- **Mock external services** (e.g., OpenAI API)

## Documentation

### Code Documentation

- Add JSDoc comments to public APIs
- Explain **why**, not just **what**
- Include examples for complex functions
- Document parameters and return types

### README Updates

When adding features, update:
- Features list
- Usage examples
- API reference
- Architecture diagrams (if applicable)

### Changelog

Add entries to `CHANGELOG.md` under "Unreleased" section:

```markdown
## [Unreleased]

### Added
- New hybrid search feature (#123)

### Fixed
- SQLite lock issue on Windows (#456)

### Changed
- Updated dependency versions
```

## Pull Request Process

1. **Ensure all tests pass**: `npm test`
2. **Update documentation**: README, JSDoc, etc.
3. **Add changelog entry**: In CHANGELOG.md
4. **Reference issues**: Use "Fixes #123" or "Closes #456"
5. **Request review**: Tag relevant reviewers
6. **Address feedback**: Respond to review comments
7. **Squash commits** (optional): Clean up commit history

### PR Review Checklist

Reviewers will check:
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No unnecessary dependencies added
- [ ] Breaking changes are documented
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Areas for Contribution

### Good First Issues

Look for issues tagged with `good-first-issue`:
- Documentation improvements
- Test coverage additions
- Bug fixes with clear reproduction steps

### High Impact Areas

See [ROADMAP.md](ROADMAP.md) for planned features:
- Hybrid search implementation
- Authentication system
- Web UI development
- Performance optimizations
- Multi-format support

### Documentation

Always welcome:
- Fix typos and grammar
- Add examples and tutorials
- Improve API documentation
- Create video walkthroughs
- Translate documentation

### Testing

Help improve coverage:
- Add edge case tests
- Integration tests
- Load/performance tests
- Security tests

## Code Review Guidelines

### For Contributors

- Be responsive to feedback
- Keep PRs focused and small
- Explain your reasoning
- Be open to suggestions

### For Reviewers

- Be constructive and kind
- Explain your suggestions
- Approve when ready
- Request changes when needed

## Community Guidelines

- **Be respectful**: Treat everyone with respect
- **Be patient**: Remember that everyone was a beginner once
- **Be collaborative**: We're all working towards the same goal
- **Be open**: Share ideas and feedback openly

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bug reports**: Open a GitHub Issue
- **Feature requests**: Check ROADMAP.md, then open an Issue
- **Chat**: Join our community (link TBD)

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

**Thank you for contributing to Hierarchical RAG!** 🎉

Every contribution, no matter how small, makes a difference.

