let g:ctrlp_custom_ignore = {
	\ 'dir':  '\v(node_modules|jspm_packages)|(\.(git|hg|svn))$',
	\ 'file': '\v(\.(exe|so|dll|swp|swo))|(src/.*\.js)$',
	\ }

" let's ignore all the generated js files!
let g:SrcJSRegex = '\(src\/.*\.js\)$'
function! SrcJSFilter(params)
	return substitute(a:params['path'].str(), 
				\ a:params['nerdtree'].root.path.str(), '', 'g') =~ g:SrcJSRegex
endfunction
call NERDTreeAddPathFilter('SrcJSFilter')
