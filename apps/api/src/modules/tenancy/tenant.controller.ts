import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { apiSchema } from '../../common/openapi';
import {
  inviteSchema,
  listSchema,
  memberUpdateSchema,
  roleSchema,
  teamSchema,
  tenantUpdateSchema,
  type RoleInput,
  type TeamInput,
} from '@showora/shared-validation';
import { Require } from '../authorization/auth.guard';
import type { AppRequest } from '../authorization/actor';
import { TenancyService } from './tenancy.service';
import { RoleService } from './role.service';
import { TeamService } from './team.service';
import { InvitationService } from '../identity/invitation.service';
import { ZodPipe } from '../../common/validation';
import { Database } from '../../common/database';
import { EntitlementService } from '../subscription/entitlement.service';
import { allowedScopes, can, permissionKeys } from '../authorization/policy';

@ApiTags('Tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(@Inject(TenancyService) private readonly tenants: TenancyService) {}
  @Get() @Require('tenant.read') get(@Req() req: AppRequest) {
    return this.tenants.me(req.actor, req.hostContext.hostname).then((m) => m.tenant);
  }
  @Get('overview') @Require('members.manage') overview(@Req() req: AppRequest) {
    return this.tenants.overview(req.actor);
  }
  @Patch() @Require('tenant.write') @ApiBody({ schema: apiSchema(tenantUpdateSchema) }) update(
    @Req() req: AppRequest,
    @Body(new ZodPipe(tenantUpdateSchema)) input: { name: string; timezone: string },
  ) {
    return this.tenants.updateTenant(req.actor, input);
  }
}
@ApiTags('Members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(
    @Inject(TenancyService) private readonly tenants: TenancyService,
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(RoleService) private readonly roles: RoleService,
  ) {}
  @Get() @Require('members.read') list(
    @Req() req: AppRequest,
    @Query(new ZodPipe(listSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.tenants.members(req.actor, query);
  }
  @Get('invitations') @Require('members.manage') invited(@Req() req: AppRequest) {
    return this.invitations.list(req.actor);
  }
  @Get('assignable-roles') @Require('members.manage') assignableRoles(@Req() req: AppRequest) {
    return this.roles.assignableRoles(req.actor);
  }
  @Post('invitations')
  @Require('members.manage')
  @ApiBody({ schema: apiSchema(inviteSchema) })
  invite(
    @Req() req: AppRequest,
    @Body(new ZodPipe(inviteSchema)) input: { email: string; roleIds: string[] },
  ) {
    return this.invitations.invite(req.actor, input.email, input.roleIds);
  }
  @Delete('invitations/:id') @Require('members.manage') @HttpCode(204) revoke(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.revoke(req.actor, id);
  }
  @Patch(':id')
  @Require('members.manage')
  @ApiBody({ schema: apiSchema(memberUpdateSchema) })
  update(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(memberUpdateSchema)) input: { status: string; roleIds: string[] },
  ) {
    return this.tenants.updateMember(req.actor, id, input);
  }
}
@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(@Inject(RoleService) private readonly roles: RoleService) {}
  @Get() @Require('roles.manage') list(@Req() req: AppRequest) {
    return this.roles.roles(req.actor);
  }
  @Post() @Require('roles.manage') @ApiBody({ schema: apiSchema(roleSchema) }) create(
    @Req() req: AppRequest,
    @Body(new ZodPipe(roleSchema)) input: RoleInput,
  ) {
    return this.roles.saveRole(req.actor, input);
  }
  @Patch(':id') @Require('roles.manage') @ApiBody({ schema: apiSchema(roleSchema) }) update(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(roleSchema)) input: RoleInput,
  ) {
    return this.roles.saveRole(req.actor, input, id);
  }
  @Delete(':id') @Require('roles.manage') @HttpCode(204) remove(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roles.deleteRole(req.actor, id);
  }
}
@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(@Inject(TeamService) private readonly teams: TeamService) {}
  @Get('eligible-members') @Require('teams.manage') eligible(
    @Req() req: AppRequest,
    @Query(new ZodPipe(listSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.teams.eligibleMembers(req.actor, query);
  }
  @Get() @Require('teams.manage') list(@Req() req: AppRequest) {
    return this.teams.teams(req.actor);
  }
  @Post() @Require('teams.manage') @ApiBody({ schema: apiSchema(teamSchema) }) create(
    @Req() req: AppRequest,
    @Body(new ZodPipe(teamSchema)) input: TeamInput,
  ) {
    return this.teams.saveTeam(req.actor, input);
  }
  @Patch(':id') @Require('teams.manage') @ApiBody({ schema: apiSchema(teamSchema) }) update(
    @Req() req: AppRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(teamSchema)) input: TeamInput,
  ) {
    return this.teams.saveTeam(req.actor, input, id);
  }
}
@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  @Get() @Require('roles.manage') list(@Req() req: AppRequest) {
    return permissionKeys
      .filter((key) => can(req.actor.permissions, key))
      .map((key) => ({
        key,
        scopes: allowedScopes(key).filter((scope) => can(req.actor.permissions, key, scope)),
      }));
  }
}
@ApiTags('Subscription')
@ApiBearerAuth()
@Controller()
export class SubscriptionController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
  ) {}
  @Get('subscription') @Require('billing.read') subscription(@Req() req: AppRequest) {
    return this.db.scoped(req.actor.tenantId, (tx) =>
      this.entitlements.read(tx, req.actor.tenantId),
    );
  }
  @Get('recovery/status') recovery(@Req() req: AppRequest) {
    return this.db.scoped(req.actor.tenantId, async (tx) => {
      const value = await this.entitlements.read(tx, req.actor.tenantId);
      return {
        status: value.status,
        writable: value.writable,
        canManageBilling: can(req.actor.permissions, 'billing.manage'),
      };
    });
  }
  @Get('audit-logs') @Require('audit.read') audit(
    @Req() req: AppRequest,
    @Query(new ZodPipe(listSchema)) query: { cursor?: string; limit: number },
  ) {
    return this.db.scoped(req.actor.tenantId, async (tx) => {
      const items = await tx.auditLog.findMany({
        where: {
          tenantId: req.actor.tenantId,
          ...(query.cursor ? { id: { gt: query.cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      });
      const data = items.slice(0, query.limit);
      return {
        data,
        page: {
          hasMore: items.length > query.limit,
          nextCursor: items.length > query.limit ? data.at(-1)!.id : null,
        },
      };
    });
  }
}
