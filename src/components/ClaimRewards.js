import { coin } from "@cosmjs/stargate";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

import { Dropdown, Badge } from "react-bootstrap";
import Coins from "./Coins";

function ClaimRewards(props) {
  async function claim() {
    props.setLoading(true);

    let totalReward = props.rewards.amount;
    let perValidatorReward = totalReward;
    let { signAndBroadcast } = props.stargateClient;
    let gas;

    if (props.restake && perValidatorReward > 0) {
      const messages = buildMessages(props.validators, perValidatorReward);

      try {
        gas = await props.stargateClient.simulate(props.address, messages);
      } catch (error) {
        props.setLoading(false);
        props.setError(`Failed to broadcast: ${error.message}`);
        return;
      }

      const fee = props.stargateClient.getFee(gas);
      const feeAmount = fee.amount[0].amount;

      signAndBroadcast =
        props.stargateClient.signAndBroadcastWithoutBalanceCheck;
      totalReward -= feeAmount;
      perValidatorReward = parseInt(totalReward / props.validators.length);
    }
    if (perValidatorReward <= 0) {
      props.setLoading(false);
      props.setError("Reward is too low");
      return;
    }
    const messages = buildMessages(props.validators, perValidatorReward);
    try {
      gas =
        gas || (await props.stargateClient.simulate(props.address, messages));
    } catch (error) {
      props.setLoading(false);
      props.setError(`Failed to broadcast: ${error.message}`);
      return;
    }
    console.log(messages, gas);

    signAndBroadcast(props.address, messages, gas).then(
      (result) => {
        console.log("Successfully broadcasted:", result);
        props.setLoading(false);
        props.onClaimRewards(result);
      },
      (error) => {
        console.log("Failed to broadcast:", error);
        props.setLoading(false);
        props.setError(`Failed to broadcast: ${error.message}`);
      }
    );
  }

  function buildMessages(validators, perValidatorReward) {
    return validators
      .map((el) => {
        const valMessages = [];

        valMessages.push({
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          value: MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: el,
          }),
        });

        if (props.restake) {
          valMessages.push({
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: MsgDelegate.fromPartial({
              delegatorAddress: props.address,
              validatorAddress: el,
              amount: coin(perValidatorReward, props.network.denom),
            }),
          });
        }

        return valMessages;
      })
      .flat();
  }

  return (
    <>
      {props.validators.length > 0 && (
        <Dropdown.Item onClick={() => claim()}>
          {props.restake ? "Manual Compound" : "Claim Rewards"}
        </Dropdown.Item>
      )}
    </>
  );
}

export default ClaimRewards;
