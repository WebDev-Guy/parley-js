/**
 * @file ValidationError.ts
 * @description Validation error class for schema validation results
 * @module parley-js/validation
 */

/**
 * Single validation error detail
 */
export interface ValidationErrorDetail {
    /** Path to the invalid field (e.g., 'user.email') */
    path: string;

    /** Error message */
    message: string;

    /** Expected type or value */
    expected?: string;

    /** Received type or value */
    received?: string;

    /** Validation rule that failed */
    rule?: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
    /** Whether the validation passed */
    valid: boolean;

    /** Array of validation errors (empty if valid) */
    errors: ValidationErrorDetail[];
}

/**
 * Create a successful validation result
 *
 * @returns Valid result
 */
export function validResult(): ValidationResult {
    return { valid: true, errors: [] };
}

/**
 * Create a failed validation result
 *
 * @param errors - Validation errors
 * @returns Invalid result
 */
export function invalidResult(errors: ValidationErrorDetail[]): ValidationResult {
    return { valid: false, errors };
}

/**
 * Create a single validation error detail
 *
 * @param path - Path to the invalid field
 * @param message - Error message
 * @param options - Additional error details
 * @returns Validation error detail
 */
export function createValidationError(
    path: string,
    message: string,
    options?: {
        expected?: string;
        received?: string;
        rule?: string;
    }
): ValidationErrorDetail {
    return {
        path,
        message,
        ...options,
    };
}

/**
 * Combine multiple validation results
 *
 * @param results - Array of validation results
 * @returns Combined result
 */
export function combineResults(...results: ValidationResult[]): ValidationResult {
    const allErrors: ValidationErrorDetail[] = [];

    for (const result of results) {
        allErrors.push(...result.errors);
    }

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
    };
}

/**
 * Format validation errors as a human-readable string
 *
 * @param result - Validation result
 * @returns Formatted error string
 */
export function formatValidationErrors(result: ValidationResult): string {
    if (result.valid) {
        return 'Validation passed';
    }

    const lines = result.errors.map((error) => {
        let line = `- ${error.path}: ${error.message}`;
        if (error.expected && error.received) {
            line += ` (expected: ${error.expected}, received: ${error.received})`;
        }
        return line;
    });

    return `Validation failed:\n${lines.join('\n')}`;
}
