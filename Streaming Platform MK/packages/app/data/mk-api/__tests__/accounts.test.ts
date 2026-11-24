import { describe, expect, it } from 'vitest'
import { displayNameFromAccountId, initialsFromName, resolveAccountDisplayName } from '../accounts'

const identity = (accountId: string, profileName: string | null = null) => ({
	accountId,
	profileId: 'profile-1',
	profileName,
})

describe('displayNameFromAccountId', () => {
	it('strips the mail domain', () => {
		expect(displayNameFromAccountId('MK-Test-Acc-Demo-1@outlook.com')).toBe('MK-Test-Acc-Demo-1')
	})

	it('returns the input when there is no domain', () => {
		expect(displayNameFromAccountId('subscriber-42')).toBe('subscriber-42')
	})

	it('falls back to the raw value for a leading @', () => {
		expect(displayNameFromAccountId('@outlook.com')).toBe('@outlook.com')
	})
})

describe('resolveAccountDisplayName', () => {
	it('prefers the configured override', () => {
		expect(resolveAccountDisplayName(identity('a@b.com', 'Profile Name'), 'Ryan Andrew')).toBe('Ryan Andrew')
	})

	it('ignores a blank override', () => {
		expect(resolveAccountDisplayName(identity('a@b.com', 'Profile Name'), '   ')).toBe('Profile Name')
	})

	it('uses the profile name when the account has a real one', () => {
		expect(resolveAccountDisplayName(identity('MK-Test-Acc-Demo-1@outlook.com', 'Anna Novak'))).toBe('Anna Novak')
	})

	it('skips the placeholder "Default" profile name', () => {
		expect(resolveAccountDisplayName(identity('MK-Test-Acc-Demo-1@outlook.com', 'Default'))).toBe('MK-Test-Acc-Demo-1')
		expect(resolveAccountDisplayName(identity('MK-Test-Acc-Demo-2@outlook.com', 'default'))).toBe('MK-Test-Acc-Demo-2')
	})

	it('falls back to the account id when there is no profile name', () => {
		expect(resolveAccountDisplayName(identity('MK-Test-Acc-Demo-3@outlook.com', null))).toBe('MK-Test-Acc-Demo-3')
		expect(resolveAccountDisplayName(identity('MK-Test-Acc-Demo-4@outlook.com', '  '))).toBe('MK-Test-Acc-Demo-4')
	})

	it('returns an empty string when the identity is unresolved and no override exists', () => {
		expect(resolveAccountDisplayName(null)).toBe('')
	})

	it('still returns the override when the identity is unresolved', () => {
		expect(resolveAccountDisplayName(null, 'Kevin Neman')).toBe('Kevin Neman')
	})
})

describe('initialsFromName', () => {
	it('takes first and last word initials', () => {
		expect(initialsFromName('Ryan Andrew')).toBe('RA')
		expect(initialsFromName('Anglo Van Durham')).toBe('AD')
	})

	it('takes the first two letters of a single word', () => {
		expect(initialsFromName('Edward')).toBe('ED')
	})

	it('splits on dots, dashes and underscores', () => {
		expect(initialsFromName('MK-Test-Acc-Demo-1')).toBe('M1')
		expect(initialsFromName('anna.novak')).toBe('AN')
	})

	it('keeps a trailing number whole so 1 and 10 stay distinguishable', () => {
		expect(initialsFromName('mk-test-acc-demo-10')).toBe('M10')
		expect(initialsFromName('mk-test-acc-demo-1')).toBe('M1')
		expect(initialsFromName('mk-test-acc-demo-10')).not.toBe(initialsFromName('mk-test-acc-demo-1'))
	})

	it('only keeps the tail whole when it is entirely numeric', () => {
		expect(initialsFromName('demo 12b')).toBe('D1')
		expect(initialsFromName('Ryan Andrew')).toBe('RA')
	})

	it('handles empty and whitespace-only names', () => {
		expect(initialsFromName('')).toBe('?')
		expect(initialsFromName('   ')).toBe('?')
	})

	it('uppercases the result', () => {
		expect(initialsFromName('chloe allen')).toBe('CA')
	})
})
