const { src, dest, parallel } = require('gulp');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const ngAnnotate = require('gulp-ng-annotate');

function compress() {
	return src(['src/balanceChanger.js'])
		.pipe(babel({presets: ['env']}))
		.pipe(ngAnnotate())
		.pipe(uglify())
		.pipe(rename('balanceChanger.min.js'))
		.pipe(dest('dist'));
}

exports.compress = compress;
exports.default = parallel(compress);
