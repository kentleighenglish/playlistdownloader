module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		watch: {
			// uglify: {
			// 	files: [
			// 		'js-source/*.js',
			// 	],
			// 	tasks: ['uglify'],
			// },
			// less: {
			// 	files: [
			// 		'less/*.less',
			// 	],
			// 	tasks: ['less']
			// },
			babel: {
				options: {
					presets: ['react']
				},
				files: [
					'precompiled/*.jsx',
				],
				tasks: ['babel']
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
				compress: true,
				preserveComments: false,
			},
			default : {
				files: [{
					expand: true,
					cwd: 'precompiled/',
					src: '**/*.js',
					dest: 'js/'
				}]
			}
		},
		// less: {
		// 	options: {
		// 		banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
		// 	},
		// 	files: {
		// 		src: [
		// 			'less/bootstrap.less'
		// 		],
		// 		dest: 'dist/style.css'
		// 	}
		// },
		babel: {
			dist: {
				files: {
					"js/app-react.js": "precompiled/app-react.jsx"
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-babel');

	// Default task(s).
	grunt.registerTask('default', ['uglify', 'less', 'watch', 'babel']);

};
