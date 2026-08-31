import 'dotenv/config';

console.log('1. Starting');

console.log('2. Loading auth controller');
await import('./src/controllers/auth.controller.js');
console.log('3. Auth controller loaded');

console.log('4. Loading case route');
await import('./src/routes/case.routes.js');
console.log('5. Case route loaded');

console.log('6. Loading evidence route');
await import('./src/routes/evidence.routes.js');
console.log('7. Evidence route loaded');

console.log('8. Loading job route');
await import('./src/routes/job.routes.js');
console.log('9. Job route loaded');

console.log('10. Loading analysis route');
await import('./src/routes/analysis.routes.js');
console.log('11. Analysis route loaded');

console.log('12. Loading recovery route');
await import('./src/routes/recovery.routes.js');
console.log('13. Recovery route loaded');

console.log('14. Loading sanitization route');
await import('./src/routes/sanitization.routes.js');
console.log('15. Sanitization route loaded');

console.log('16. Loading audit route');
await import('./src/routes/audit.routes.js');
console.log('17. Audit route loaded');

console.log('18. Loading report route');
await import('./src/routes/report.routes.js');
console.log('19. Report route loaded');

console.log('DONE');