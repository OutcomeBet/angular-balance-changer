const gulp = require('gulp');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const ngAnnotate = require('gulp-ng-annotate');

gulp.task('default', ['compress']);

gulp.task('compress', function() {
	return gulp.src(['src/balanceChanger.js'])
		.pipe(babel({presets: ['es2015']}))
		.pipe(ngAnnotate())
		.pipe(uglify())
		.pipe(rename('balanceChanger.min.js'))
		.pipe(gulp.dest('dist'));
});
