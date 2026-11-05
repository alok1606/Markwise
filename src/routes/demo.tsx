import {createFileRoute,Link} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import {Brand} from '@/components/brand';
import {meta} from '@/lib/access';
export const Route=createFileRoute('/demo')({head:()=>meta('Demo access','Controlled Markwise demo account access.'),component:()=> <div className="mx-auto max-w-3xl px-6 py-10"><Link to="/"><Brand/></Link><h1 className="mt-20 text-3xl font-semibold">Demo access</h1><p className="mt-5 leading-7 text-muted-foreground">Demo testing uses administrator-provisioned accounts. Public role selection is not available. Fictional brand data and review workflows are not included in Phase 1.</p><Button asChild className="mt-8"><Link to="/auth">Sign in with your provisioned account</Link></Button></div>});