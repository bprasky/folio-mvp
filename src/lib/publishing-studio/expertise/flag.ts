/** My expertise is available by default; an explicit false remains an operational kill switch. */
export const expertiseEnabled = () => process.env.STUDIO_MY_EXPERTISE !== 'false';
