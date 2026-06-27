# Contributing to ɳTasks

Thank you for considering contributing to ɳTasks! This document outlines the guidelines for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/nself-org/ntask/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Backend provider being used
   - Screenshots if applicable
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check [Discussions](https://github.com/nself-org/ntask/discussions) for existing suggestions
2. Create a new discussion with:
   - Clear use case
   - Proposed implementation (if you have ideas)
   - Benefits to users
   - Potential challenges

### Pull Requests

1. **Fork the repository**

   ```bash
   git clone https://github.com/nself-org/ntask.git
   cd ntask
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation
   - Keep commits focused and atomic

4. **Test your changes**

   ```bash
   npm run build
   npm run typecheck
   npm run lint
   ```

5. **Test with multiple backends**
   Test your changes with different backend providers:
   - `EXPO_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql` (mobile)
   - `VITE_HASURA_URL=http://localhost:8080/v1/graphql` (web SaaS)

6. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

7. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template
   - Link related issues

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Use functional components with hooks
- Keep files under 300 lines when possible
- Use Tailwind CSS for styling
- No inline styles

### Backend Abstraction

**NEVER** import backend SDKs directly. Always use the abstraction layer:

```typescript
// ❌ BAD
import { createClient } from '@supabase/supabase-js';

// ✅ GOOD
import { useAuth } from '@/lib/providers';
```

### Component Structure

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/providers';

export function MyComponent() {
  // 1. Hooks
  const { user } = useAuth();
  const [state, setState] = useState();

  // 2. Functions
  function handleClick() {}

  // 3. Effects
  useEffect(() => {}, []);

  // 4. Render
  return <div>...</div>;
}
```

### File Organization

```
components/
  feature-name/
    main-component.tsx
    sub-component.tsx
    types.ts
    utils.ts
```

### Testing

- Test with all backend providers
- Test responsive design (mobile, tablet, desktop)
- Test dark/light themes
- Test offline functionality if applicable
- Test error states

### Documentation

- Update README.md if adding features
- Add JSDoc comments for complex functions
- Update BACKEND.md if changing backend logic
- Include examples in comments

## Adding New Features

### New Backend Provider

1. Create adapter directory: `lib/backend/new-provider/`
2. Implement all interfaces from `lib/types/backend.ts`
3. Add to factory in `lib/backend/index.ts`
4. Add config to `lib/config.ts`
5. Add env vars to `.env.example`
6. Document in BACKEND.md

### New Auth Method

1. Add to `AuthMethod` type in `lib/auth-config.ts`
2. Add default config in `DEFAULT_METHODS`
3. Add icon in `components/auth/social-auth-button.tsx`
4. Update docs

### New Hook

1. Create in `hooks/use-[name].ts`
2. Export from `hooks/index.ts`
3. Add JSDoc comments
4. Add example in README.md

### New UI Component

Use shadcn/ui components when possible:

```bash
npx shadcn-ui@latest add [component-name]
```

For custom components:

1. Create in `components/[feature]/`
2. Use existing UI components as building blocks
3. Make it responsive
4. Support dark mode

## Review Process

1. Maintainers will review your PR
2. Address any feedback
3. Once approved, maintainer will merge
4. Your contribution will be credited in release notes

## Questions?

- Check existing [Issues](https://github.com/nself-org/ntask/issues)
- Join [Discussions](https://github.com/nself-org/ntask/discussions)
- Read [README.md](README.md) and [BACKEND.md](BACKEND.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to ɳTasks!
