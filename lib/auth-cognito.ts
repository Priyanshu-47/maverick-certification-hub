import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import { prisma } from "./db";
import type { IdentityProvider } from "./auth";
import type { SessionUser } from "@/types";

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-2",
});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

export class CognitoIdentityProvider implements IdentityProvider {
  async authenticate({ email, password }: { email: string; password?: string }): Promise<SessionUser | null> {
    if (!password) throw new Error("Password required");

    try {
      const result = await client.send(new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }));

      if (result.ChallengeName === "NEW_PASSWORD_REQUIRED") {
        throw new Error("Please change your temporary password first.");
      }

      const userResult = await client.send(new GetUserCommand({
        AccessToken: result.AuthenticationResult?.AccessToken,
      }));

      const getAttr = (name: string) => userResult.UserAttributes?.find((a) => a.Name === name)?.Value;

      const cognitoRole = getAttr("custom:role") || "ReadOnly";
      const employeeId = getAttr("custom:employeeId") || null;
      const name = getAttr("name") || email.split("@")[0];

      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (dbUser) {
        return { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, employeeId: dbUser.employeeId };
      }

      const newUser = await prisma.user.create({
        data: { email, name, role: cognitoRole as any, employeeId },
      });

      return { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, employeeId: newUser.employeeId };
    } catch (err: any) {
      if (err.name === "NotAuthorizedException" || err.name === "UserNotFoundException") {
        return null;
      }
      throw err;
    }
  }
}
