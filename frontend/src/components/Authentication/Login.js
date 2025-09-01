import { useState, useContext } from "react";
import {
  Flex,
  Heading,
  Input,
  Button,
  InputGroup,
  Stack,
  InputLeftElement,
  chakra,
  Box,
  Link,
  Avatar,
  FormControl,
  FormHelperText,
  InputRightElement,
  Card,
  CardBody,
  useToast,
  Spinner,
  Tooltip,
} from "@chakra-ui/react";
import { FaLock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import chatContext from "../../context/chatContext";
import { ArrowBackIcon } from "@chakra-ui/icons";

const CFaLock = chakra(FaLock);

const Login = (props) => {
  const { hostName, socket, setUser, setIsAuthenticated, fetchData } =
    useContext(chatContext);
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordShow, setForgotPasswordShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShowClick = () => setShowPassword(!showPassword);

  const showtoast = (title, description, status) => {
    toast({
      title,
      description,
      status,
      duration: 4000,
      isClosable: true,
      position: "top",
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = { email };
    const otp = document.getElementById("otp")?.value;

    if (otp?.length > 0 && forgotPasswordShow) {
      data.otp = otp;
    } else {
      data.password = password;
    }

    try {
      const response = await fetch(`${hostName}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resdata = await response.json();

      if (!response.ok) {
        showtoast("Login failed", resdata.error || "Something went wrong", "error");
        setLoading(false);
        return;
      }

      // ✅ save token and user
      localStorage.setItem("token", resdata.authtoken);
      localStorage.setItem("user", JSON.stringify(resdata.user));

      // ✅ update state (this will trigger rerenders in context consumers)
      setUser(resdata.user);
      setIsAuthenticated(true);

      // ✅ reconnect socket
      if (resdata.user?._id && socket) {
        socket.connect();
        socket.emit("setup", resdata.user._id);
      }

      // ✅ fetch data before navigating
      await fetchData();

      showtoast("Login successful", "You are now logged in", "success");

      // ✅ navigate
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error(error);
      showtoast("Error", "Something went wrong, please try again", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch(`${hostName}/auth/getotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const resdata = await response.json();
      setSending(false);

      if (!response.ok) {
        showtoast("Error", resdata.error || "Could not send OTP", "error");
        return;
      }

      showtoast("OTP Sent", "Check your email", "success");
    } catch (error) {
      setSending(false);
      console.error(error);
      showtoast("Error", "Something went wrong", "error");
    }
  };

  return (
    <Flex
      flexDirection="column"
      width="100wh"
      height="70vh"
      justifyContent="center"
      alignItems="center"
      borderRadius={15}
    >
      <Stack flexDir="column" mb="2" justifyContent="center" alignItems="center">
        <Avatar bg="purple.300" />
        <Heading color="purple.400">Welcome Back</Heading>
        <Card minW={{ base: "90%", md: "468px" }} borderRadius={15} shadow={0}>
          <CardBody p={0}>
            <form onSubmit={handleLogin}>
              <Stack spacing={4}>
                {forgotPasswordShow && (
                  <Tooltip label="login" aria-label="A tooltip">
                    <Button
                      w="fit-content"
                      onClick={() => setForgotPasswordShow(false)}
                    >
                      <ArrowBackIcon />
                    </Button>
                  </Tooltip>
                )}

                <FormControl display="flex">
                  <InputGroup borderRadius="10px" size="lg">
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Email address"
                      focusBorderColor="purple.500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </InputGroup>
                  {forgotPasswordShow && (
                    <Button m={1} fontSize="sm" onClick={handleSendOtp}>
                      {sending ? <Spinner size="sm" /> : "Send OTP"}
                    </Button>
                  )}
                </FormControl>

                {!forgotPasswordShow && (
                  <FormControl>
                    <InputGroup borderRadius="10px" size="lg">
                      <InputLeftElement pointerEvents="none">
                        <CFaLock color="gray.300" />
                      </InputLeftElement>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        focusBorderColor="purple.500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <InputRightElement mx={1}>
                        <Button
                          fontSize="x-small"
                          size="xs"
                          onClick={handleShowClick}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                    <FormHelperText textAlign="right">
                      <Link onClick={() => setForgotPasswordShow(true)}>
                        forgot password?
                      </Link>
                    </FormHelperText>
                  </FormControl>
                )}

                {forgotPasswordShow && (
                  <FormControl>
                    <InputGroup borderRadius="10px" size="lg">
                      <Input
                        id="otp"
                        type="number"
                        placeholder="Enter OTP"
                        focusBorderColor="purple.500"
                      />
                    </InputGroup>
                  </FormControl>
                )}

                <Button
                  borderRadius={10}
                  type="submit"
                  variant="solid"
                  colorScheme="purple"
                  width="full"
                  isLoading={loading}
                  loadingText="Logging in..."
                >
                  {forgotPasswordShow ? "Login using OTP" : "Login"}
                </Button>
              </Stack>
            </form>
          </CardBody>
        </Card>
      </Stack>
      <Box>
        New to us?{" "}
        <Link color="purple.500" onClick={() => props.handleTabsChange(1)}>
          Sign Up
        </Link>
      </Box>
    </Flex>
  );
};

export default Login;
