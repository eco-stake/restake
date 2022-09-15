import moment from 'moment'
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";

function createAuthzAuthorizationAminoConverter(){
  return {
    "/cosmos.authz.v1beta1.GenericAuthorization": {
      aminoType: "cosmos-sdk/GenericAuthorization",
      toAmino: (value) => GenericAuthorization.decode(value),
      fromAmino: ({ msg }) => (GenericAuthorization.encode(GenericAuthorization.fromPartial({
        msg: msg
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
        console.log(granter, grantee, grant)
        converter = grantConverter[grant.authorization.typeUrl]
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
        protoType = Object.keys(grantConverter).find(type => grantConverter[type].aminoType === grant.authorization.type)
        converter = grantConverter[protoType]
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
          // MsgExec amino doesn't include type and value is lifted
          return aminoTypes.toAmino({ typeUrl, value: msgType.decode(value) }).value
        })
      }),
      fromAmino: () => {
        throw new Error('MsgExec fromAmino is not possible')
      }
      // fromAmino: ({ grantee, msgs }) => ({
      //   grantee,
      //   msgs: msgs.map(({type, value}) => {
      //     const proto = aminoTypes.fromAmino({ type, value })
      //     const typeUrl = proto.typeUrl
      //     const msgType = registry.lookupType(typeUrl)
      //     return {
      //       typeUrl,
      //       value: msgType.encode(msgType.fromPartial(proto.value)).finish()
      //     }
      //   })
      // }),
    },
  };
}
