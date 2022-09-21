import moment from 'moment'
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz.js";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz.js";

function createAuthzAuthorizationAminoConverter(){
  return {
    "/cosmos.authz.v1beta1.GenericAuthorization": {
      aminoType: "cosmos-sdk/GenericAuthorization",
      toAmino: (value) => GenericAuthorization.decode(value),
      fromAmino: ({ msg }) => (GenericAuthorization.encode(GenericAuthorization.fromPartial({
        msg
      })).finish())
    },
    "/cosmos.staking.v1beta1.StakeAuthorization": {
      aminoType: "cosmos-sdk/StakeAuthorization",
      toAmino: (value) => {
        const { allowList, maxTokens, authorizationType } = StakeAuthorization.decode(value)
        return {
          Validators: {
            type: "cosmos-sdk/StakeAuthorization/AllowList",
            value: {
              allow_list: allowList
            }
          },
          max_tokens: maxTokens,
          authorization_type: authorizationType
        }
      },
      fromAmino: ({ allow_list, max_tokens, authorization_type }) => (StakeAuthorization.encode(StakeAuthorization.fromPartial({
        allowList: allow_list,
        maxTokens: max_tokens,
        authorizationType: authorization_type
      })).finish())
    }
  }
}

const dateConverter = {
  toAmino(date){
    return moment(date.seconds.toNumber() * 1000).utc().format()
  },
  fromAmino(date){
    return {
      seconds: moment(date).unix(),
      nanos: 0
    }
  }
}

export function createAuthzAminoConverters() {
  const grantConverter = createAuthzAuthorizationAminoConverter()
  return {
    "/cosmos.authz.v1beta1.MsgGrant": {
      aminoType: "cosmos-sdk/MsgGrant",
      toAmino: ({ granter, grantee, grant }) => {
        const converter = grantConverter[grant.authorization.typeUrl]
        return {
          granter,
          grantee,
          grant: {
            authorization: {
              type: converter.aminoType,
              value: converter.toAmino(grant.authorization.value)
            },
            expiration: dateConverter.toAmino(grant.expiration)
          }
        }
      },
      fromAmino: ({ granter, grantee, grant }) => {
        const protoType = Object.keys(grantConverter).find(type => grantConverter[type].aminoType === grant.authorization.type)
        const converter = grantConverter[protoType]
        return {
          granter,
          grantee,
          grant: {
            authorization: {
              typeUrl: protoType,
              value: converter.fromAmino(grant.authorization.value)
            },
            expiration: dateConverter.fromAmino(grant.expiration)
          }
        }
      },
    },
    "/cosmos.authz.v1beta1.MsgRevoke": {
      aminoType: "cosmos-sdk/MsgRevoke",
      toAmino: ({ granter, grantee, msgTypeUrl }) => ({
        granter,
        grantee,
        msg_type_url: msgTypeUrl
      }),
      fromAmino: ({ granter, grantee, msg_type_url }) => ({
        granter,
        grantee,
        msgTypeUrl: msg_type_url
      }),
    },
  };
}

export function createAuthzExecAminoConverters(registry, aminoTypes) {
  return {
    "/cosmos.authz.v1beta1.MsgExec": {
      aminoType: "cosmos-sdk/MsgExec",
      toAmino: ({ grantee, msgs }) => ({
        grantee,
        msgs: msgs.map(({typeUrl, value}) => {
          const msgType = registry.lookupType(typeUrl)
          return aminoTypes.toAmino({ typeUrl, value: msgType.decode(value) })
        })
      }),
      fromAmino: ({ grantee, msgs }) => ({
        grantee,
        msgs: msgs.map(({type, value}) => {
          const proto = aminoTypes.fromAmino({ type, value })
          const typeUrl = proto.typeUrl
          const msgType = registry.lookupType(typeUrl)
          return {
            typeUrl,
            value: msgType.encode(msgType.fromPartial(proto.value)).finish()
          }
        })
      }),
    },
  };
}
