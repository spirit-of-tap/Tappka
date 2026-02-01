
231-235: Remove explicit any type annotation for identity.

If the User type is properly imported (as suggested earlier), the identity type will be correctly inferred from user.identities. Remove the explicit any annotation.

Proposed fix
-                  {user.identities?.map((identity: any) => (
+                  {user.identities?.map((identity) => (
                     <Badge key={identity.id} variant="outline" className="mr-2">
                       {identity.provider}
                     </Badge>
                   ))}

---