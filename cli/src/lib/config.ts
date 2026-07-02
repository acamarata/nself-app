/**
 * Endpoint + profile configuration for the ɳTask CLI/MCP client.
 *
 * Purpose:    Resolve GraphQL + auth base URLs from (in priority order)
 *             explicit flags, environment variables, the active stored
 *             profile, then a hardcoded "local" default.
 * Inputs:     Optional CLI flag overrides, process.env, and the credentials
 *             file's `activeProfile` pointer.
 * Outputs:    `resolveEndpoints()` -> { apiUrl, authUrl, profileName }.
 * Constraints: Never hardcodes secrets. Profile presets match the three
 *             documented nSelf ntask environments (local/staging/prod).
 * SPORT:      n/a (CLI-local config, not a tracked domain entity).
 */

export interface EndpointOverrides {
  readonly endpoint?: string;
  readonly apiUrl?: string;
  readonly authUrl?: string;
}

export interface ResolvedEndpoints {
  readonly apiUrl: string;
  readonly authUrl: string;
  readonly profileName: string;
}

/** Named endpoint presets. `endpoint`/profile shorthand maps to these. */
export const PROFILE_PRESETS: Record<string, { apiUrl: string; authUrl: string }> = {
  local: {
    apiUrl: 'http://localhost:8080/v1/graphql',
    authUrl: 'http://localhost:4000',
  },
  staging: {
    apiUrl: 'https://api.task.staging.nself.org/v1/graphql',
    authUrl: 'https://auth.task.staging.nself.org',
  },
  prod: {
    apiUrl: 'https://api.task.nself.org/v1/graphql',
    authUrl: 'https://auth.task.nself.org',
  },
};

/**
 * Resolve the active GraphQL + auth URLs.
 * Priority: explicit --endpoint preset name > --api-url/--auth-url flags >
 * NTASK_API_URL/NTASK_AUTH_URL env vars > stored profile's preset > 'local'.
 */
export function resolveEndpoints(
  overrides: EndpointOverrides,
  storedProfile?: string,
): ResolvedEndpoints {
  const presetName = overrides.endpoint ?? storedProfile ?? 'local';
  const preset = PROFILE_PRESETS[presetName] ?? PROFILE_PRESETS.local!;

  const apiUrl = overrides.apiUrl ?? process.env.NTASK_API_URL ?? preset.apiUrl;
  const authUrl = overrides.authUrl ?? process.env.NTASK_AUTH_URL ?? preset.authUrl;

  return { apiUrl, authUrl, profileName: presetName };
}
