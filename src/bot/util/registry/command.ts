import { PermissionFlagsBits, ApplicationCommandType } from 'discord.js';
import type {
  APIApplicationCommandBasicOption,
  APIApplicationCommandSubcommandGroupOption,
  APIApplicationCommandSubcommandOption,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  ContextMenuCommandInteraction,
  PermissionFlags,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  User,
} from 'discord.js';
import { type Serializable, SerializableMap } from './serializableMap.js';
import { Predicate, type InvalidPredicateCallback, type PredicateCheck } from './predicate.js';
import { ensureI18nLoaded, getTranslationsForKey } from '../i18n.js';
import type { TFunction } from 'i18next';
import i18next from 'i18next';

await ensureI18nLoaded();

export class UnimplementedError extends TypeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class CommandIndex implements Serializable {
  private key: string[];
  private isContext?: boolean;

  constructor(
    data: ChatInputCommandInteraction | ContextMenuCommandInteraction | (string | null)[],
  ) {
    let key: (string | null)[];

    if (Array.isArray(data)) {
      key = data;
    } else {
      if (data.isContextMenuCommand()) {
        this.isContext = true;
        key = [data.commandName];
      } else {
        key = [
          data.commandName,
          data.options.getSubcommandGroup(false),
          data.options.getSubcommand(false),
        ];
      }
    }

    this.key = key.filter((x) => x !== null);
  }

  get serialized(): string {
    return this.key.join('.');
  }

  toString(): string {
    return this.isContext
      ? `[Context Command "${this.key.join(' ')}"]`
      : `[Slash Command /${this.key.join(' ')}]`;
  }
}
export class AutocompleteIndex implements Serializable {
  private commandKey: string[];
  private autocompleteName: string;

  constructor(interaction: AutocompleteInteraction);
  constructor(commandKey: (string | null)[], autocompleteName: string);
  constructor(data: AutocompleteInteraction | (string | null)[], autocompleteName?: string) {
    let key: (string | null)[];

    if (Array.isArray(data)) {
      if (!autocompleteName)
        throw new TypeError('autocompleteName is required when initialising AutocompleteIndex');
      key = data;
      this.autocompleteName = autocompleteName;
    } else {
      key = [
        data.commandName,
        data.options.getSubcommandGroup(false),
        data.options.getSubcommand(false),
      ];
      this.autocompleteName = data.options.getFocused(true).name;
    }

    this.commandKey = key.filter((x) => x !== null);
  }

  get serialized(): string {
    return `${this.commandKey.join('.')}%${this.autocompleteName}`;
  }

  toString(): string {
    return `[Autocomplete Command /${this.commandKey.join(' ')} (${this.autocompleteName})]`;
  }
}

type CommandExecutableFunction = (args: {
  interaction: ChatInputCommandInteraction<'cached'>;
  client: Client;
  t: TFunction<'content'>;
}) => Promise<void> | void;

type ContextCommandExecutableFunction = (args: {
  interaction: ContextMenuCommandInteraction<'cached'>;
  client: Client;
}) => Promise<void> | void;

type AutocompleteFunction = (args: {
  interaction: AutocompleteInteraction<'cached'>;
  client: Client;
}) => Promise<void> | void;

type CommandMap<V> = SerializableMap<CommandIndex, V>;
type AutocompleteMap<V> = SerializableMap<AutocompleteIndex, V>;

export interface CommandPredicateConfig {
  validate: (user: User) => Predicate;
  invalidCallback: InvalidPredicateCallback<
    ChatInputCommandInteraction | ContextMenuCommandInteraction
  >;
}

type CommandPredicateCheck = PredicateCheck<
  ChatInputCommandInteraction | ContextMenuCommandInteraction
>;

export abstract class Command {
  /**
   * The data representing the command in the API format.
   * This is required for registering the command with the API.
   */
  public abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;

  /**
   * The mode in which the command is deployed (e.g., LOCAL_ONLY or GLOBAL).
   * This prevents accidental global deployment of development commands.
   */
  public abstract readonly deploymentMode: DeploymentMode;

  /**
   * Executes the command when invoked by an interaction.
   *
   * @param index - The index of the command.
   * @param interaction - The interaction event that triggered the command execution, which can be either
   *                      a chat input command or a context menu command.
   * @returns A promise that resolves when the command execution is complete.
   */
  public abstract execute(
    index: CommandIndex,
    interaction: ChatInputCommandInteraction<'cached'> | ContextMenuCommandInteraction<'cached'>,
  ): Promise<void>;

  /**
   * Checks if the user meets the criteria (predicates) to execute this command.
   *
   * **Implementors of this method should call {@link evaluatePredicate()} with this command's predicate config.**
   *
   * @param index - The index of the command being checked.
   * @param user - The user attempting to execute the command.
   * @returns A result indicating whether the command can be executed by the user and any associated callbacks.
   */
  public abstract checkPredicate(index: CommandIndex, user: User): CommandPredicateCheck;

  /**
   * Evaluates a given predicate against a user to determine if they are allowed to execute the command.
   *
   * @param predicate - The configuration of the predicate that defines access rules.
   * @param user - The user to validate against the predicate.
   * @returns A result object containing the evaluation status and any callback to be executed if denied.
   */
  protected evaluatePredicate(
    predicate: CommandPredicateConfig | null,
    user: User,
  ): CommandPredicateCheck {
    if (!predicate) return { status: Predicate.Allow };

    const status = predicate.validate(user);

    return status === Predicate.Allow
      ? { status }
      : { status, callback: predicate.invalidCallback };
  }
}

export abstract class SlashCommand extends Command {
  public readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody;

  constructor(options: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, 'description'>) {
    super();

    this.data = {
      ...options,
      description: i18next.t(`commands:${options.name}.description`, { lng: 'en-US' }),
      dm_permission: false,
      description_localizations: getTranslationsForKey(`commands:${options.name}.description`),
    };
  }

  public abstract execute(
    index: CommandIndex,
    interaction: ChatInputCommandInteraction<'cached'>,
  ): Promise<void>;

  public abstract autocomplete(
    index: AutocompleteIndex,
    interaction: AutocompleteInteraction<'cached'>,
  ): Promise<void>;
}

export type BasicSlashCommandData = Omit<
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  'options' | 'dm_permission' | 'name_localizations' | 'description_localizations' | 'description'
> & {
  options?: APIApplicationCommandBasicOption[];
};

class BasicSlashCommand extends SlashCommand {
  constructor(
    data: BasicSlashCommandData,
    private predicate: CommandPredicateConfig | null,
    public readonly deploymentMode: DeploymentMode,
    private executables: {
      execute: CommandExecutableFunction;
      autocomplete: AutocompleteMap<AutocompleteFunction>;
    },
  ) {
    super(data);
  }

  public checkPredicate(_idx: CommandIndex, user: User) {
    return this.evaluatePredicate(this.predicate, user);
  }

  public async execute(
    _idx: CommandIndex,
    interaction: ChatInputCommandInteraction<'cached'>,
  ): Promise<void> {
    await this.executables.execute({
      interaction,
      client: interaction.client,
      t: i18next.getFixedT([interaction.locale, 'en-US'], 'content'),
    });
  }

  public async autocomplete(
    idx: AutocompleteIndex,
    interaction: AutocompleteInteraction<'cached'>,
  ): Promise<void> {
    const autocomplete = this.executables.autocomplete.get(idx);
    if (!autocomplete) {
      throw new UnimplementedError(`Autocomplete not implemented: ${idx}`);
    }

    await autocomplete({ interaction, client: interaction.client });
  }
}

class ParentSlashCommand extends SlashCommand {
  // `predicate` is Omitted here to avoid its accidental use later; predicateMap should be
  // used because it holds the combined predicates for all subcommands up the tree.
  // It is likely that at runtime the CommandMap will include SlashSubcommands in their entirety; this is acceptable.
  private subcommandMap: CommandMap<Omit<SlashSubcommand, 'predicate'>> = new SerializableMap();
  private autocompleteMap: AutocompleteMap<AutocompleteFunction> = new SerializableMap();
  private predicateMap: CommandMap<CommandPredicateConfig | null> = new SerializableMap();

  constructor(
    baseData: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, 'options' | 'dm_permission'>,
    commandPredicate: CommandPredicateConfig | null,
    public readonly deploymentMode: DeploymentMode,
    options: { subcommands: SlashSubcommand[]; groups: SlashSubcommandGroup[] },
  ) {
    if (options.subcommands.length < 1 && options.groups.length < 1) {
      throw new Error('A parent slash command must have at least one child subcommand or group.');
    }

    const data: RESTPostAPIChatInputApplicationCommandsJSONBody = baseData;

    data.options = [];

    function getLocalizations(key: string) {
      return {
        description: i18next.t(key, { lng: 'en-US' }),
        description_localizations: getTranslationsForKey(key),
      };
    }

    for (const subcommand of options.subcommands) {
      const localized = getLocalizations(
        `commands:${baseData.name}.options.${subcommand.data.name}.description`,
      );
      data.options.push({ ...subcommand.data, ...localized });
    }

    for (const group of options.groups) {
      const groupData = group.data;
      groupData.options = [];
      for (const subcommand of group.subcommands) {
        const localized = getLocalizations(
          `commands:${baseData.name}.options.${groupData.name}.options.${subcommand.data.name}.description`,
        );
        groupData.options.push({ ...subcommand.data, ...localized });
      }

      const localized = getLocalizations(
        `commands:${baseData.name}.options.${groupData.name}.description`,
      );

      data.options.push({ ...groupData, ...localized });
    }

    super(data);

    for (const subcommand of options.subcommands) {
      const idxKey = [data.name, subcommand.data.name];
      const idx = new CommandIndex(idxKey);

      this.subcommandMap.set(idx, subcommand);
      // the predicate with the greatest level of specificity is selected.
      this.predicateMap.set(idx, subcommand.predicate ?? commandPredicate ?? null);

      for (const name in subcommand.autocomplete) {
        const fn = subcommand.autocomplete[name];
        this.autocompleteMap.set(new AutocompleteIndex(idxKey, name), fn);
      }
    }

    for (const group of options.groups) {
      const groupData = group.data;
      groupData.options = [];
      for (const subcommand of group.subcommands) {
        const idxKey = [this.data.name, group.data.name, subcommand.data.name];
        const idx = new CommandIndex(idxKey);
        this.subcommandMap.set(idx, subcommand);

        // the predicate with the greatest level of specificity is selected.
        const predicate = subcommand.predicate ?? group.predicate ?? commandPredicate ?? null;
        this.predicateMap.set(idx, predicate);

        for (const name in subcommand.autocomplete) {
          const fn = subcommand.autocomplete[name];
          this.autocompleteMap.set(new AutocompleteIndex(idxKey, name), fn);
        }
      }
    }
  }

  public checkPredicate(idx: CommandIndex, user: User) {
    const predicate = this.predicateMap.get(idx);
    if (predicate === undefined) {
      // This should never happen: `predicate` might be null but should never be undefined.
      throw new Error(`failed to find entry in predicate map for ${idx}`);
    }
    return this.evaluatePredicate(predicate, user);
  }

  public async execute(
    index: CommandIndex,
    interaction: ChatInputCommandInteraction<'cached'>,
  ): Promise<void> {
    const command = this.subcommandMap.get(index);
    if (!command) {
      throw new UnimplementedError(`Failed to find a subcommand for command ${index}`);
    }
    await command.execute({
      interaction,
      client: interaction.client,
      t: i18next.getFixedT([interaction.locale, 'en-US'], 'content'),
    });
  }

  public async autocomplete(
    idx: AutocompleteIndex,
    interaction: AutocompleteInteraction<'cached'>,
  ): Promise<void> {
    const autocomplete = this.autocompleteMap.get(idx);
    if (!autocomplete) {
      throw new UnimplementedError(`Autocomplete not implemented: ${idx}`);
    }

    await autocomplete({ interaction, client: interaction.client });
  }
}

export class SlashSubcommand {
  public readonly execute: CommandExecutableFunction;
  public readonly autocomplete: Record<string, AutocompleteFunction> | null;

  constructor(
    public readonly data: Omit<APIApplicationCommandSubcommandOption, 'description'>,
    public readonly predicate: CommandPredicateConfig | null,
    executables: {
      execute: CommandExecutableFunction;
      autocomplete?: Record<string, AutocompleteFunction>;
    },
  ) {
    this.execute = executables.execute;
    this.autocomplete = executables.autocomplete ?? null;
  }
}

export class SlashSubcommandGroup {
  constructor(
    public readonly data: Omit<APIApplicationCommandSubcommandGroupOption, 'description'>,
    public readonly subcommands: SlashSubcommand[],
    public readonly predicate: CommandPredicateConfig | null,
  ) {
    if (subcommands.length < 1) {
      throw new Error('A slash command subcommand group must have at least one child subcommand.');
    }
  }
}

/** Defines the behaviour of where commands are deployed. */
export const Deploy = {
  /** This command can only be deployed manually. */
  Never: 'NEVER',
  /** This command will be ignored when deploying globally. */
  LocalOnly: 'LOCAL_ONLY',
  /** This command can be automatically deployed to any guild. */
  Global: 'GLOBAL',
} as const;

export type DeploymentMode = (typeof Deploy)[keyof typeof Deploy];

export const command = {
  basic: function (args: {
    data: BasicSlashCommandData;
    predicate?: CommandPredicateConfig;
    execute: CommandExecutableFunction;
    autocomplete?: Record<string, AutocompleteFunction>;
    deploymentMode?: DeploymentMode;
  }): SlashCommand {
    const predicate = args.predicate ?? null;

    const deploymentMode = args.deploymentMode ?? Deploy.Global;

    const autocompleteMap: AutocompleteMap<AutocompleteFunction> = new SerializableMap();
    for (const name in args.autocomplete) {
      const fn = args.autocomplete[name];
      autocompleteMap.set(new AutocompleteIndex([args.data.name], name), fn);
    }

    return new BasicSlashCommand(args.data, predicate, deploymentMode, {
      execute: args.execute,
      autocomplete: autocompleteMap,
    });
  },
  parent: function (args: {
    data: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, 'options' | 'dm_permission'>;
    predicate?: CommandPredicateConfig;
    subcommands?: SlashSubcommand[];
    groups?: SlashSubcommandGroup[];
    deploymentMode?: DeploymentMode;
  }): SlashCommand {
    const deploymentMode = args.deploymentMode ?? Deploy.Global;

    const predicate = args.predicate ?? null;
    const components = { subcommands: args.subcommands ?? [], groups: args.groups ?? [] };

    return new ParentSlashCommand(args.data, predicate, deploymentMode, components);
  },
};

export function subcommand(args: {
  data: APIApplicationCommandSubcommandOption;
  predicate?: CommandPredicateConfig;
  execute: CommandExecutableFunction;
  autocomplete?: Record<string, AutocompleteFunction>;
}): SlashSubcommand {
  const predicate = args.predicate ?? null;
  const executables = { execute: args.execute, autocomplete: args.autocomplete };

  return new SlashSubcommand(args.data, predicate, executables);
}

export function subcommandGroup(args: {
  data: APIApplicationCommandSubcommandGroupOption;
  predicate?: CommandPredicateConfig;
  subcommands: SlashSubcommand[];
}): SlashSubcommandGroup {
  return new SlashSubcommandGroup(args.data, args.subcommands, args.predicate ?? null);
}

/**
 * A utility to build permissions fields.
 * @example
 * default_member_permissions = permissions(permissions.KickMember, permissions.BanMember)
 */
export const permissions: PermissionFlags & ((...permissions: bigint[]) => string) = Object.assign(
  (...permissions: bigint[]) => permissions.reduce((prev, current) => prev | current).toString(),
  PermissionFlagsBits,
);

export class ContextCommand extends Command {
  public data: RESTPostAPIContextMenuApplicationCommandsJSONBody;

  constructor(
    data: RESTPostAPIContextMenuApplicationCommandsJSONBody,
    private predicate: CommandPredicateConfig | null,
    public readonly deploymentMode: DeploymentMode,
    private executeFn: ContextCommandExecutableFunction,
  ) {
    super();
    this.data = data;
  }

  public checkPredicate(_idx: CommandIndex, user: User) {
    return this.evaluatePredicate(this.predicate, user);
  }

  public async execute(
    _idx: CommandIndex,
    interaction: ContextMenuCommandInteraction<'cached'>,
  ): Promise<void> {
    await this.executeFn({ interaction, client: interaction.client });
  }
}

function contextConstructor(type: ApplicationCommandType.User | ApplicationCommandType.Message) {
  return function (args: {
    data: Omit<RESTPostAPIContextMenuApplicationCommandsJSONBody, 'type'>;
    execute: ContextCommandExecutableFunction;
    predicate?: CommandPredicateConfig;
    deploymentMode?: DeploymentMode;
  }) {
    const predicate = args.predicate ?? null;
    return new ContextCommand(
      { ...args.data, type },
      predicate,
      args.deploymentMode ?? Deploy.Global,
      args.execute,
    );
  };
}

export const context = {
  user: contextConstructor(ApplicationCommandType.User),
  message: contextConstructor(ApplicationCommandType.Message),
};
