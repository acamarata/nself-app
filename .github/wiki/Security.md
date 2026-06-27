# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

The ɳTasks team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to the project maintainer. You can find the contact information in the repository.

Include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- You should receive an acknowledgment within 48 hours
- We will investigate the issue and provide regular updates on our progress
- We will work with you to understand and address the vulnerability
- Once the issue is resolved, we will publicly acknowledge your responsible disclosure (unless you prefer to remain anonymous)

## Security Best Practices

When using ɳTasks, please follow these security best practices:

### Environment Variables

- Never commit `.env` files to version control
- Use different credentials for development, staging, and production
- Rotate credentials regularly
- Use secrets management services in production

### Authentication

- Always enable Row Level Security (RLS) on database tables
- Use strong, unique passwords
- Enable multi-factor authentication when available
- Implement proper session timeout policies

### Data Protection

- Never log sensitive information (passwords, tokens, API keys)
- Encrypt sensitive data at rest and in transit
- Follow the principle of least privilege for database access
- Regularly backup your data

### Code Security

- Keep dependencies up to date
- Review and audit third-party packages before use
- Validate and sanitize all user input
- Use parameterized queries to prevent SQL injection
- Implement proper error handling without exposing sensitive information

### Backend-Specific Security

#### nself

- Follow nself security best practices
- Keep your nself instance updated
- Configure appropriate firewall rules

#### Supabase

- Enable RLS on all tables
- Use Row Level Security policies appropriate for your use case
- Regularly review and update your security policies
- Use Supabase's built-in auth features

#### Nhost

- Follow Nhost security guidelines
- Configure Hasura permissions correctly
- Use environment variables for sensitive configuration
- Enable appropriate CORS policies

## Known Security Considerations

### Default Configuration

This boilerplate comes with reasonable security defaults, but you should:

1. Review and customize RLS policies for your use case
2. Configure appropriate CORS settings
3. Set up proper rate limiting
4. Implement logging and monitoring
5. Configure proper backup strategies

### Third-Party Integrations

When adding third-party services:

1. Review their security practices
2. Use environment variables for API keys
3. Implement proper error handling
4. Follow the principle of least privilege
5. Regularly audit integrations

## Security Updates

Security updates will be published through:

- GitHub Security Advisories
- Release notes
- The project's CHANGELOG

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [Nhost Security](https://docs.nhost.io/guides/auth/security)

## Questions

If you have questions about security that aren't appropriate for a public forum, please contact the maintainers directly.
